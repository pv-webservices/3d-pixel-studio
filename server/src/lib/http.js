// Error type and response helpers shared by the route modules.
import { z } from 'zod';

export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message  safe to show to the admin user
   * @param {object} [details] field errors or context, also safe to show
   */
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (what = 'Record') => new HttpError(404, `${what} not found`);

/** Validate input with a zod schema, turning failures into a 400 with per-field messages. */
export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw new HttpError(400, 'Please correct the highlighted fields.', { fields });
}

export function errorHandler(logger) {
  // Express recognises error middleware by its four arguments.
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    if (err?.type === 'entity.too.large') err = new HttpError(413, 'Request body is too large.');
    if (err?.type === 'entity.parse.failed') err = new HttpError(400, 'Request body is not valid JSON.');
    if (err?.name === 'MulterError') {
      err = new HttpError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than the upload limit.' : 'Upload was not accepted.');
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, ...(err.details ?? {}) });
      return;
    }
    // Client errors raised by Express internals (e.g. a missing /uploads file) are not server faults.
    const status = err?.status ?? err?.statusCode;
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      res.status(status).json({ error: status === 404 ? 'Not found' : 'Request was not accepted.' });
      return;
    }
    logger.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  };
}

export const trimmed = (max) => z.string().trim().max(max, `Keep this under ${max} characters.`);
