/** Fails the server at startup if configuration is unsafe (e.g. worker and reviewer are the same model). */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertServerConfig } = await import('./lib/env.ts');
    assertServerConfig();
  }
}
