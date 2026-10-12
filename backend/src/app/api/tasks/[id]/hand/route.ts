import { z } from 'zod';
import { apiRoute, IdParams } from '../../../../../lib/api/handler.ts';
import { handTask } from '../../../../../lib/services/tasks.ts';

export const POST = apiRoute({ write: true, params: IdParams, body: z.object({}).strict() }, async ({ db, human, params }) =>
  handTask(db, human, params.id),
);
