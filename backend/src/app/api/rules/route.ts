import { z } from 'zod';
import { apiRoute } from '../../../lib/api/handler.ts';
import { createRule, listRules } from '../../../lib/services/rules.ts';

const Keywords = z.array(z.string().trim().min(2).max(60)).max(20);

const NewRule = z
  .object({
    text: z.string().trim().min(3).max(300),
    kind: z.enum(['ask_first', 'never', 'style']),
    keywords: Keywords.optional(),
  })
  .strict();

export const GET = apiRoute({}, async ({ db, human }) => ({ rules: await listRules(db, human) }));

export const POST = apiRoute({ write: true, body: NewRule }, async ({ db, human, body }) => createRule(db, human, body));
