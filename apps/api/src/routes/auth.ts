import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import type { User, Session } from '@platform/shared-types';

export const authRouter = new Hono();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /auth/register
authRouter.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password: _password, name } = c.req.valid('json');

  // Hash password, create user, generate session
  // In-memory storage for Phase 1
  const user: User = {
    id: crypto.randomUUID(),
    email,
    name,
    avatarUrl: null,
    authProvider: 'email',
    createdAt: new Date().toISOString(),
  };

  const session: Session = {
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    user,
  };

  return c.json(session, 201);
});

// POST /auth/login
authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email } = c.req.valid('json');

  const user: User = {
    id: crypto.randomUUID(),
    email,
    name: email.split('@')[0] || 'User',
    avatarUrl: null,
    authProvider: 'email',
    createdAt: new Date().toISOString(),
  };

  const session: Session = {
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    user,
  };

  return c.json(session);
});

// GET /auth/session
authRouter.get('/session', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return c.json({ valid: true });
});
