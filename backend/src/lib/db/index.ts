import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema.ts';

export { schema };

/** Works for node-postgres in production and PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const g = globalThis as unknown as { __idaDb?: Db; __idaPool?: pg.Pool };

export function createPgDb(url: string): { db: Db; pool: pg.Pool } {
  const pool = new pg.Pool({
    connectionString: url,
    // Serverless functions: keep the pool tiny; use the provider's pooled URL.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
  });
  return { db: drizzle(pool, { schema }) as unknown as Db, pool };
}

export function getDb(): Db {
  if (g.__idaDb) return g.__idaDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const { db, pool } = createPgDb(url);
  g.__idaDb = db;
  g.__idaPool = pool;
  return db;
}

/** Test hook: point the app at a specific database (PGlite or a test Postgres). */
export function setDbForTests(db: Db | undefined): void {
  g.__idaDb = db;
}
