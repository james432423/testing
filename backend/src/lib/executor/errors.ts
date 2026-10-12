/** Kept separate so error handling can import it without importing the executor. */
export type RefusalCode =
  | 'approval_not_found'
  | 'bad_signature'
  | 'approval_used'
  | 'approval_expired'
  | 'action_not_found'
  | 'content_invalid'
  | 'content_mismatch'
  | 'action_not_sendable'
  | 'auto_not_permitted'
  | 'approver_not_member';

export class ExecutorRefusal extends Error {
  readonly code: RefusalCode;
  constructor(code: RefusalCode) {
    super(`executor refused: ${code}`);
    this.code = code;
  }
}
