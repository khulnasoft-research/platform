import { createMiddleware } from 'hono/factory';
import { authService } from '../services/auth-service.js';

export const requireAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const session = await authService.validateSession(token);

  if (!session) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('userId', session.userId);
  c.set('email', session.email);

  await next();
});

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    email: string;
  }
}
