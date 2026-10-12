/**
 * Fresh database per test file. Uses a real Postgres when TEST_DATABASE_URL
 * is set (a new database is created and dropped), otherwise in-process PGlite.
 */
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { schema, type Db } from '../src/lib/db/index.ts';

const MIGRATIONS = path.resolve(__dirname, '..', 'drizzle');

export type TestDb = { db: Db; kind: 'postgres' | 'pglite'; close: () => Promise<void>; exec: (sql: string) => Promise<void> };

export async function createTestDb(): Promise<TestDb> {
  const base = process.env.TEST_DATABASE_URL;
  if (base) {
    const pg = (await import('pg')).default;
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const name = `ida_t_${randomBytes(6).toString('hex')}`;
    const admin = new pg.Client({ connectionString: base });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${name}`);
    await admin.end();
    const url = new URL(base);
    url.pathname = `/${name}`;
    const pool = new pg.Pool({ connectionString: url.toString(), max: 4 });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return {
      db: db as unknown as Db,
      kind: 'postgres',
      exec: async (sql) => { await pool.query(sql); },
      close: async () => {
        await pool.end();
        const a = new pg.Client({ connectionString: base });
        await a.connect();
        await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
        await a.end();
      },
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as Db, kind: 'pglite', exec: async (sql) => { await client.exec(sql); }, close: () => client.close() };
}
