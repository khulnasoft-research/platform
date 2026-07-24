import { createMiddleware } from 'hono/factory';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyFn?: (c: any) => string;
}

export function rateLimit(config: RateLimitConfig) {
  const store = new Map<string, { count: number; resetAt: number }>();

  return createMiddleware(async (c, next) => {
    const key = config.keyFn
      ? config.keyFn(c)
      : c.req.header('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const entry = store.get(key);

    if (entry && now < entry.resetAt) {
      entry.count++;
      if (entry.count > config.max) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
    } else {
      store.set(key, { count: 1, resetAt: now + config.windowMs });
    }

    await next();
  });
}
