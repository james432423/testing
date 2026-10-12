import { apiRoute } from '../../../lib/api/handler.ts';
import { listSent } from '../../../lib/services/misc.ts';

export const GET = apiRoute({}, async ({ db, human }) => ({ sent: await listSent(db, human) }));
