/**
 * Turns an Auth.js database session into a HumanSession. This is the only
 * place a HumanSession is constructed, so owner approvals can only originate
 * from a signed-in, still-allowlisted person.
 */
import { auth } from '../../auth.ts';
import { allowedEmails } from '../env.ts';
import type { Db } from '../db/index.ts';
import type { HumanSession } from '../gate/approvals.ts';
import { ensureWorkspaceForUser } from '../seed/seed.ts';

export async function requireHuman(db: Db): Promise<HumanSession | null> {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string | null; name?: string | null } | undefined;
  if (!user?.id || !user.email) return null;
  // Removing someone from ALLOWED_EMAILS cuts off existing sessions too.
  if (!allowedEmails().has(user.email.toLowerCase())) return null;
  const workspaceId = await ensureWorkspaceForUser(db, { id: user.id, name: user.name });
  return { userId: user.id, workspaceId } as HumanSession;
}
