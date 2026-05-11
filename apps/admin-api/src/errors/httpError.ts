/**
 * HttpError: erro semântico que o errorHandler converte em response JSON.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const NotFound = (msg = "Not found") => new HttpError(404, msg);
export const BadRequest = (msg = "Bad request", details?: unknown) =>
  new HttpError(400, msg, details);
export const Conflict = (msg = "Conflict") => new HttpError(409, msg);
