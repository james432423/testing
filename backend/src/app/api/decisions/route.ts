import { z } from 'zod';
import { apiRoute, json } from '../../../lib/api/handler.ts';
import { listDecisions } from '../../../lib/services/decisions.ts';

const Query = z.object({ status: z.enum(['open', 'later', 'done', 'all']).default('open') }).strict();

export const GET = apiRoute({}, async ({ req, db, human }) => {
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return json({ error: 'bad_query' }, 400);
  return { decisions: await listDecisions(db, human, q.data.status) };
});
