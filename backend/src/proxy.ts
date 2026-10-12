/**
 * Runs before every request (Node.js runtime in Next 16).
 *
 * Signed out, the only reachable paths are /signin, /api/auth/* (Auth.js),
 * /api/health and framework assets. Everything else, including the static
 * prototype under /app, requires a valid database session. Route handlers
 * check the session again (defense in depth), so a matcher mistake here
 * cannot expose data on its own.
 */
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { API_CSP, pageCsp } from './lib/security/csp.ts';

const PUBLIC_PATHS = [/^\/signin\/?$/, /^\/api\/auth(\/|$)/, /^\/api\/health\/?$/, /^\/favicon\.ico$/];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((rx) => rx.test(pathname));
}

type AuthedRequest = NextRequest & { auth: { user?: unknown } | null };

function handle(req: AuthedRequest): Response {
  const { pathname, search } = req.nextUrl;
  const signedIn = !!req.auth?.user;

  if (!signedIn && !isPublic(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'Content-Security-Policy': API_CSP, 'cache-control': 'no-store' } });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    url.search = '';
    // Only same-site relative paths are ever used as the return target.
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  // The prototype relies on relative links, so /app must end with a slash.
  if (pathname === '/app') {
    const url = req.nextUrl.clone();
    url.pathname = '/app/';
    return NextResponse.redirect(url, 308);
  }

  // /app/* sets its own CSP in the route handler.
  if (pathname.startsWith('/app/')) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    const res = NextResponse.next();
    res.headers.set('Content-Security-Policy', API_CSP);
    return res;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = pageCsp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

type ProxyFn = (req: NextRequest, ev: NextFetchEvent) => Promise<Response>;
let withAuth: Promise<ProxyFn> | null = null;

// Next requires a plain function export named `proxy`. Auth.js is loaded lazily
// because its database driver makes the module async, which Turbopack's proxy
// loader does not resolve.
export async function proxy(req: NextRequest, ev: NextFetchEvent): Promise<Response> {
  withAuth ??= import('./auth.ts').then(({ auth }) => auth((r) => handle(r as AuthedRequest)) as unknown as ProxyFn);
  return (await withAuth)(req, ev);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
