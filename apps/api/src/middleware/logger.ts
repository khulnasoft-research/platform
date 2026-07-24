import { createMiddleware } from 'hono/factory';

let requestCounter = 0;

function generateId(): string {
  requestCounter++;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}-${requestCounter}`;
}

function shouldLog(level: string): boolean {
  const configured = process.env.LOG_LEVEL || 'info';
  const levels = ['debug', 'info', 'warn', 'error'];
  return levels.indexOf(level) >= levels.indexOf(configured);
}

export const structuredLogger = createMiddleware(async (c, next) => {
  const requestId = generateId();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);

  const start = performance.now();
  const method = c.req.method;
  const path = c.req.path;
  const url = new URL(c.req.url);
  const query = url.search;

  await next();

  const duration = Math.round((performance.now() - start) * 100) / 100;
  const status = c.res.status;

  const logEntry = {
    requestId,
    timestamp: new Date().toISOString(),
    method,
    path: query ? `${path}?${query}` : path,
    status,
    durationMs: duration,
    userAgent: c.req.header('user-agent') || '',
    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '',
  };

  if (status >= 500 && shouldLog('error')) {
    console.error(JSON.stringify({ level: 'error', ...logEntry }));
  } else if (status >= 400 && shouldLog('warn')) {
    console.warn(JSON.stringify({ level: 'warn', ...logEntry }));
  } else if (shouldLog('info')) {
    console.log(JSON.stringify({ level: 'info', ...logEntry }));
  }
});

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}
