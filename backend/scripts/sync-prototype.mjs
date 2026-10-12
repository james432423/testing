#!/usr/bin/env node
/**
 * Copies the static prototype into ./prototype (NOT public/, so nothing is
 * served without going through the authenticated route handler), adds a
 * sign-out link, and writes prototype/manifest.json with the file list and
 * the SHA-256 hashes of every inline <script> for the CSP.
 *
 * Usage: node scripts/sync-prototype.mjs [sourceDir]
 * The source directory itself is never modified.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const src = path.resolve(process.argv[2] ?? process.env.PROTOTYPE_SRC ?? '../site2');
const out = path.resolve('prototype');
const ALLOWED = new Set(['.html', '.js', '.css', '.svg', '.png', '.jpg', '.webp', '.ico', '.woff2']);
const SIGN_OUT = '<a href="/signout" style="position:fixed;right:12px;bottom:12px;z-index:9999;font:500 13px/1.2 system-ui,sans-serif;color:inherit;opacity:.7">Sign out</a>';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const files = [];
const scriptHashes = new Set();
for (const name of readdirSync(src).sort()) {
  const full = path.join(src, name);
  if (!statSync(full).isFile()) continue;
  const ext = path.extname(name).toLowerCase();
  if (!ALLOWED.has(ext)) continue; // e.g. vercel.json is not part of the app
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error(`unexpected file name: ${name}`);
  let buf = readFileSync(full);
  if (ext === '.html') {
    let html = buf.toString('utf8');
    if (html.includes('</body>')) html = html.replace('</body>', `${SIGN_OUT}\n</body>`);
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
      scriptHashes.add(`sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}`);
    }
    buf = Buffer.from(html, 'utf8');
  }
  writeFileSync(path.join(out, name), buf);
  files.push(name);
}

writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify({ source: path.basename(src), files, scriptHashes: [...scriptHashes].sort() }, null, 2)}\n`);
console.log(`copied ${files.length} files, ${scriptHashes.size} inline script hashes`);
