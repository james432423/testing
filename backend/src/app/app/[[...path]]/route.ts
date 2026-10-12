/**
 * Serves the static prototype from ./prototype, only to signed-in users.
 *
 * The files are not in public/, so there is no way to fetch them without this
 * handler. Paths are looked up in prototype/manifest.json by exact name; the
 * request path is never joined onto the filesystem, so traversal is impossible.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getDb } from '../../../lib/db/index.ts';
import { requireHuman } from '../../../lib/api/session.ts';
import { ASSET_CSP, prototypeCsp } from '../../../lib/security/csp.ts';

export const dynamic = 'force-dynamic';

const ROOT = path.join(process.cwd(), 'prototype');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

type Manifest = { files: string[]; scriptHashes: string[] };
let manifest: Promise<Manifest> | null = null;
function loadManifest(): Promise<Manifest> {
  manifest ??= readFile(path.join(ROOT, 'manifest.json'), 'utf8').then((s) => JSON.parse(s) as Manifest);
  return manifest;
}

export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }): Promise<Response> {
  const human = await requireHuman(getDb());
  if (!human) {
    return Response.redirect(new URL('/signin', req.url), 303);
  }
  const { path: parts = [] } = await ctx.params;
  let name = parts.length === 0 ? 'index.html' : parts.join('/');
  const m = await loadManifest();
  if (!m.files.includes(name) && m.files.includes(`${name}.html`)) name = `${name}.html`;
  if (!m.files.includes(name)) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });

  const body = await readFile(path.join(ROOT, name));
  const headers: Record<string, string> = {
    'content-type': TYPES[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
    // Behind sign-in: never cache in shared caches.
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
  };
  // Non-HTML files get a lock-down policy too: an SVG opened directly is a
  // document and could otherwise run script.
  headers['content-security-policy'] = name.endsWith('.html') ? prototypeCsp(m.scriptHashes) : ASSET_CSP;
  return new Response(new Uint8Array(body), { status: 200, headers });
}
