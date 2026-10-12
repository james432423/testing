import { z } from 'zod';
import { apiRoute, IdParams } from '../../../../../lib/api/handler.ts';
import { notNow } from '../../../../../lib/services/decisions.ts';

export const POST = apiRoute({ write: true, params: IdParams, body: z.object({}).strict() }, async ({ db, human, params }) =>
  notNow(db, human, params.id),
);
