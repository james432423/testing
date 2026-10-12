import { z } from 'zod';
import { apiRoute, IdParams } from '../../../../../lib/api/handler.ts';
import { LIMITS } from '../../../../../lib/ratelimit.ts';
import { runWorkflowOnce } from '../../../../../lib/services/workflows.ts';

/** Runs the worker once on a deal; the draft goes through the full gate. */
export const POST = apiRoute(
  { write: true, params: IdParams, body: z.object({ dealId: z.string().uuid() }).strict(), limit: { bucket: 'run', limit: LIMITS.run } },
  async ({ db, human, params, body }) => runWorkflowOnce(db, human, params.id, body.dealId),
);
