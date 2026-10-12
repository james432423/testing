import { apiRoute } from '../../../lib/api/handler.ts';
import { listDeals } from '../../../lib/services/misc.ts';

export const GET = apiRoute({}, async ({ db, human }) => ({ deals: await listDeals(db, human) }));
