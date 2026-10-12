import { z } from 'zod';
import { apiRoute, IdParams } from '../../../../../lib/api/handler.ts';
import { approveDecision } from '../../../../../lib/services/decisions.ts';

const Body = z.object({ contentHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict();

export const POST = apiRoute({ write: true, params: IdParams, body: Body }, async ({ db, human, params, body }) =>
  approveDecision(db, human, params.id, body.contentHash),
);
