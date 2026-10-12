import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The prototype under /app uses relative links that need "/app/" to keep its slash.
  skipTrailingSlashRedirect: true,
  // Ship the prototype files with the serverless function that serves them.
  outputFileTracingIncludes: { '/app/[[...path]]': ['./prototype/**/*'] },
  serverExternalPackages: ['pg'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Clickjacking: only the prototype may be framed, and only by itself.
      { source: '/((?!app/).*)', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
    ];
  },
};

export default config;
