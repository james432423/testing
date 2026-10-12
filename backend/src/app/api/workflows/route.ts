import { apiRoute } from '../../../lib/api/handler.ts';
import { listWorkflows } from '../../../lib/services/workflows.ts';

export const GET = apiRoute({}, async ({ db, human }) => ({ workflows: await listWorkflows(db, human) }));
