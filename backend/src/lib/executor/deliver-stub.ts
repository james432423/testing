/**
 * Delivery stub. In this build nothing leaves the server: a "send" is a row
 * in sent_log. A real Gmail integration replaces this function (and must keep
 * being called only from executor.ts).
 */
import type { Db } from '../db/index.ts';
import { sentLog } from '../db/schema.ts';
import type { ActionContent } from '../gate/action.ts';

export type Delivery = {
  workspaceId: string;
  actionId: string;
  approvalId: string;
  workflowId: string;
  dealId: string;
  how: 'approve' | 'auto';
  content: ActionContent;
  contentHash: string;
  sentAt: Date;
};

export async function deliverStub(db: Db, d: Delivery): Promise<string> {
  const [row] = await db
    .insert(sentLog)
    .values({
      workspaceId: d.workspaceId,
      origin: 'executor',
      actionId: d.actionId,
      approvalId: d.approvalId,
      workflowId: d.workflowId,
      dealId: d.dealId,
      how: d.how,
      recipients: { to: d.content.to, cc: d.content.cc },
      subject: d.content.subject,
      body: d.content.body,
      contentHash: d.contentHash,
      sentAt: d.sentAt,
    })
    .returning({ id: sentLog.id });
  return row!.id;
}
