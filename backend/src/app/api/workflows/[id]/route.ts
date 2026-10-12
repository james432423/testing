import { z } from 'zod';
import { apiRoute, IdParams } from '../../../../lib/api/handler.ts';
import { updateWorkflow } from '../../../../lib/services/workflows.ts';

const Patch = z
  .object({
    level: z.enum(['practice', 'approve', 'auto']).optional(),
    paused: z.boolean().optional(),
  })
  .strict()
  .refine((b) => b.level !== undefined || b.paused !== undefined, { message: 'Nothing to change.' });

export const PATCH = apiRoute({ write: true, params: IdParams, body: Patch }, async ({ db, human, params, body }) =>
  updateWorkflow(db, human, params.id, body),
);
