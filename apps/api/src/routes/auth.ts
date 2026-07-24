import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import { authService } from '../services/auth-service.js';
import { requireAuth } from '../middleware/auth.js';

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

authRouter.post('/register', zValidator('json', registerSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    const result = await authService.register(data);
    return c.json(result, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return c.json({ error: message }, 409);
  }
});

authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    const result = await authService.login(data);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return c.json({ error: message }, 401);
  }
});

authRouter.get('/session', requireAuth, async (c) => {
  return c.json({ valid: true, userId: c.get('userId'), email: c.get('email') });
});
