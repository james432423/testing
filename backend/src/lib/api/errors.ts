export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

export const notFound = () => new HttpError(404, 'not_found');
export const conflict = (msg: string) => new HttpError(409, 'conflict', msg);
export const forbidden = (msg = 'forbidden') => new HttpError(403, 'forbidden', msg);
