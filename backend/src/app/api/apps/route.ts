import { apiRoute } from '../../../lib/api/handler.ts';
import { listApps } from '../../../lib/services/misc.ts';

/** Stub: lists connection status only. Connecting real apps is not built yet. */
export const GET = apiRoute({}, async ({ db, human }) => ({ apps: await listApps(db, human), stub: true }));
