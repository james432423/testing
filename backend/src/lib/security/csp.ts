/**
 * Content-Security-Policy builders.
 *
 * App pages (sign-in): nonce-based, no 'unsafe-inline' for scripts.
 * API responses: nothing may load.
 * Prototype (/app/*): scripts are same-origin files plus SHA-256 hashes for
 *   the four inline <script> blocks in the static prototype (computed by
 *   scripts/sync-prototype.mjs). Exception: style-src needs 'unsafe-inline'
 *   because the prototype uses style="" attributes and sets styles from JS.
 *   Inline styles cannot run code, so this is the accepted trade-off.
 */
const isDev = process.env.NODE_ENV === 'development';

function join(d: Record<string, string>): string {
  return Object.entries(d)
    .map(([k, v]) => `${k} ${v}`.trim())
    .join('; ');
}

const FONT_CSS = 'https://fonts.googleapis.com';
const FONT_FILES = 'https://fonts.gstatic.com';

export function pageCsp(nonce: string): string {
  return join({
    'default-src': "'self'",
    'script-src': `'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    'style-src': `'self' 'unsafe-inline' ${FONT_CSS}`,
    'img-src': "'self' data: https://lh3.googleusercontent.com",
    'font-src': `'self' ${FONT_FILES}`,
    'connect-src': "'self'",
    'object-src': "'none'",
    'base-uri': "'self'",
    // Chrome applies form-action to the redirect after a form post, and the
    // sign-in form redirects to Google.
    'form-action': "'self' https://accounts.google.com",
    'frame-ancestors': "'none'",
    ...(isDev ? {} : { 'upgrade-insecure-requests': '' }),
  });
}

/** Static assets (SVG, CSS, JS, images) served from the prototype: nothing may run inside them. */
export const ASSET_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'";

export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function prototypeCsp(scriptHashes: string[]): string {
  return join({
    'default-src': "'self'",
    'script-src': `'self' ${scriptHashes.map((h) => `'${h}'`).join(' ')}`.trim(),
    'style-src': `'self' 'unsafe-inline' ${FONT_CSS}`,
    'img-src': "'self' data:",
    'font-src': FONT_FILES,
    'connect-src': "'self'",
    'frame-src': "'self'",
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
    // The prototype opens source documents in same-origin iframes.
    'frame-ancestors': "'self'",
  });
}
