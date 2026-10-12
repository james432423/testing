import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth, signIn } from '../../auth.ts';

/** Only same-site relative paths are accepted as a return target. */
function safeNext(raw: unknown): string {
  const v = typeof raw === 'string' ? raw : '';
  return /^\/(?!\/)[A-Za-z0-9/_.\-?=&#%]*$/.test(v) && !v.startsWith('/api/') ? v : '/app/';
}

const ERRORS: Record<string, string> = {
  AccessDenied: 'That Google account is not on the beta list. Ask Ida\'s team to add it, then try again.',
  Configuration: 'Sign-in is not set up correctly yet. Nothing about your account has changed.',
};

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection(); // dynamic rendering, so the CSP nonce is applied
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const session = await auth();
  if (session?.user) redirect(next);
  const err = typeof sp.error === 'string' ? (ERRORS[sp.error] ?? 'Sign-in did not finish. Try again.') : null;

  return (
    <main className="sheet">
      <p className="wordmark">ida</p>
      <h1>Sign in to Ida</h1>
      <p>Ida handles the routine emails on your deals and asks you only for decisions.</p>
      {err ? <p className="problem" role="alert">Problem: {err}</p> : null}
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: next });
        }}
      >
        <button className="btn" type="submit">Continue with Google</button>
      </form>
      <p className="fine">Private beta. Only invited Google accounts can sign in. Ida sees your name and email address, nothing else.</p>
    </main>
  );
}
