/**
 * Error summaries that are safe to log. Database errors carry the failed
 * query AND its parameters in their message (Drizzle: "Failed query: ...
 * params: <values>"), which can include session tokens, email addresses and
 * draft text. Only the error class and a machine-readable code are logged.
 */
export function safeErrorSummary(e: unknown): string {
  if (!(e instanceof Error)) return 'unknown error';
  const codes: string[] = [];
  let cur: unknown = e;
  for (let depth = 0; cur && typeof cur === 'object' && depth < 5; depth++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(code)) codes.push(code);
    cur = (cur as { cause?: unknown }).cause;
  }
  // Auth.js errors carry their class name in `type` (`name` is minified in builds).
  const type = (e as { type?: unknown }).type;
  const name = typeof type === 'string' && /^[A-Za-z]{1,40}$/.test(type) ? type : e.name;
  return `${name}${codes.length ? ` (${codes.join(' < ')})` : ''}`;
}
