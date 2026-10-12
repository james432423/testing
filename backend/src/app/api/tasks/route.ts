import { z } from 'zod';
import { apiRoute } from '../../../lib/api/handler.ts';
import { addTask, listTasks } from '../../../lib/services/tasks.ts';

const AddTask = z
  .object({
    name: z.string().trim().min(3).max(200),
    area: z.enum(['Leads', 'Deals', 'Listings', 'Admin']).default('Admin'),
    handToIda: z.boolean().default(false),
  })
  .strict();

export const GET = apiRoute({}, async ({ db, human }) => ({ tasks: await listTasks(db, human) }));

export const POST = apiRoute({ write: true, body: AddTask }, async ({ db, human, body }) => addTask(db, human, body));
