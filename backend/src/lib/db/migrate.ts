import path from 'node:path';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export const MIGRATIONS_DIR = path.resolve(process.cwd(), 'drizzle');

export async function migrateNodePg(db: NodePgDatabase<Record<string, unknown>>): Promise<void> {
  await migratePg(db, { migrationsFolder: MIGRATIONS_DIR });
}
