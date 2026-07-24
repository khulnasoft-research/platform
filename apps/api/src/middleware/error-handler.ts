import type { ErrorHandler } from 'hono';

interface ErrorResponse {
  error: string;
  requestId?: string;
  status: number;
  details?: unknown;
}

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') || '';
  const status = err instanceof SyntaxError ? 400 : 500;
  const isProduction = process.env.NODE_ENV === 'production';

  const response: ErrorResponse = {
    error: status === 400 ? 'Invalid request body' : 'Internal server error',
    requestId,
    status,
  };

  if (status === 500) {
    console.error(JSON.stringify({
      level: 'error',
      requestId,
      error: err.message,
      stack: isProduction ? undefined : err.stack,
    }));
  }

  if (!isProduction && status === 500) {
    response.details = err.message;
  }

  return c.json(response, status);
};
