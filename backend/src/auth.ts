/**
 * Auth.js (NextAuth v5) with Google sign-in and DATABASE sessions.
 *
 * - The browser holds only an opaque session token in an httpOnly,
 *   SameSite=Lax cookie (Secure + __Secure- prefix in production). The
 *   session itself lives in the `sessions` table and can be revoked.
 * - Auth.js provides CSRF protection for its own POST endpoints (double-submit
 *   token) and validates OAuth state + PKCE.
 * - Private beta: only verified Google emails listed in ALLOWED_EMAILS can sign
 *   in. The check runs before any user row is created.
 * - Google OAuth tokens are dropped before they reach the database: we only
 *   need identity, not Gmail access, in this build.
 */
import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import type { Adapter, AdapterAccount } from 'next-auth/adapters';
import { getDb } from './lib/db/index.ts';
import { accounts, sessions, users, verificationTokens } from './lib/db/schema.ts';
import { allowedEmails } from './lib/env.ts';
import { audit } from './lib/audit.ts';
import { safeErrorSummary } from './lib/log.ts';

function buildAdapter(): Adapter {
  const db = getDb();
  const base = DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });
  return {
    ...base,
    linkAccount: (account: AdapterAccount) =>
      base.linkAccount!({
        ...account,
        access_token: undefined,
        refresh_token: undefined,
        id_token: undefined,
        session_state: undefined,
      }),
  };
}

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const isProd = process.env.NODE_ENV === 'production';

export const { handlers, auth, signIn, signOut } = NextAuth((): NextAuthConfig => ({
  adapter: buildAdapter(),
  session: { strategy: 'database', maxAge: SESSION_MAX_AGE, updateAge: 24 * 60 * 60 },
  useSecureCookies: isProd,
  trustHost: process.env.AUTH_TRUST_HOST === 'true' || !!process.env.VERCEL,
  providers: [
    Google({
      authorization: { params: { scope: 'openid email profile', prompt: 'select_account' } },
    }),
  ],
  pages: { signIn: '/signin', error: '/signin' },
  // Auth.js's default logger prints the full cause, and adapter errors embed
  // the query parameters - including the session token being looked up.
  logger: {
    error: (error: Error) => console.error('[auth][error]', safeErrorSummary(error)),
    warn: (code: string) => console.warn('[auth][warn]', code),
    debug: () => {},
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return false;
      const email = typeof profile?.email === 'string' ? profile.email.toLowerCase() : '';
      const verified = profile?.email_verified === true;
      const ok = verified && allowedEmails().has(email);
      if (!ok) {
        await audit(getDb(), { workspaceId: null, actorKind: 'system', event: 'auth.denied', data: { reason: verified ? 'not_allowlisted' : 'unverified_email' } }).catch(() => {});
      }
      return ok;
    },
    async session({ session, user }) {
      if (session.user) (session.user as { id?: string }).id = user.id;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await audit(getDb(), { workspaceId: null, actorKind: 'user', actorId: user.id ?? null, event: 'auth.signed_in' }).catch(() => {});
    },
    async signOut(message) {
      const userId = 'session' in message && message.session ? (message.session as { userId?: string }).userId : undefined;
      await audit(getDb(), { workspaceId: null, actorKind: 'user', actorId: userId ?? null, event: 'auth.signed_out' }).catch(() => {});
    },
  },
}));
