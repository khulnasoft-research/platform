import { Hono } from 'hono';
import { db } from '../db/index.js';

export const healthRouter = new Hono();

healthRouter.get('/health', async (c) => {
  let dbStatus = 'unconfigured';
  if (process.env.DATABASE_URL) {
    try {
      await db.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
  }

  return c.json({
    status: 'healthy',
    version: '0.1.0',
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      database: dbStatus,
      redis: process.env.REDIS_URL ? 'healthy' : 'unconfigured',
      ai: { status: 'healthy', providers: detectProviders() },
    },
  });
});

function detectProviders(): string[] {
  const providers: string[] = [];
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) providers.push('google');
  return providers;
}
