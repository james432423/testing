import { z } from 'zod';
import { apiRoute, IdParams } from '../../../../../lib/api/handler.ts';
import { editAndApprove } from '../../../../../lib/services/decisions.ts';

const Body = z
  .object({
    subject: z.string().trim().min(1).max(300).optional(),
    body: z.string().trim().min(1).max(20_000).optional(),
  })
  .strict()
  .refine((b) => b.subject !== undefined || b.body !== undefined, { message: 'Change the subject or the body.' });

export const POST = apiRoute({ write: true, params: IdParams, body: Body }, async ({ db, human, params, body }) =>
  editAndApprove(db, human, params.id, body),
);
