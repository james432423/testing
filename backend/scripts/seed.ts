/**
 * Loads the Dana Reyes sample world.
 *   npm run db:seed -- dana@example.com   pre-provision the workspace for that (allowlisted) user
 *   npm run db:seed                        create a standalone demo workspace
 * Signing in also provisions a seeded workspace automatically on first visit.
 */
import { eq } from 'drizzle-orm';
import { createPgDb } from '../src/lib/db/index.ts';
import { users, workspaces } from '../src/lib/db/schema.ts';
import { ensureWorkspaceForUser, seedWorkspace } from '../src/lib/seed/seed.ts';
import { OWNER } from '../src/lib/seed/sample-world.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const email = process.argv[2]?.trim().toLowerCase();
const { db, pool } = createPgDb(url);
try {
  if (email) {
    let [u] = await db.select().from(users).where(eq(users.email, email));
    if (!u) [u] = await db.insert(users).values({ email, name: OWNER.name }).returning();
    const ws = await ensureWorkspaceForUser(db, { id: u!.id, name: u!.name });
    console.log(`workspace ${ws} ready for ${email}`);
  } else {
    const [ws] = await db.insert(workspaces).values({ name: OWNER.business, ownerName: OWNER.name }).returning({ id: workspaces.id });
    await seedWorkspace(db, ws!.id);
    console.log(`demo workspace ${ws!.id} seeded`);
  }
} finally {
  await pool.end();
}
