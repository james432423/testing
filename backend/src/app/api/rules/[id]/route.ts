import { z } from 'zod';
import { apiRoute, IdParams } from '../../../../lib/api/handler.ts';
import { deleteRule, updateRule } from '../../../../lib/services/rules.ts';

const Patch = z
  .object({
    text: z.string().trim().min(3).max(300).optional(),
    enabled: z.boolean().optional(),
    keywords: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to change.' });

export const PATCH = apiRoute({ write: true, params: IdParams, body: Patch }, async ({ db, human, params, body }) =>
  updateRule(db, human, params.id, body),
);

export const DELETE = apiRoute({ write: true, params: IdParams }, async ({ db, human, params }) => deleteRule(db, human, params.id));
