import { Hono } from 'hono';

export const healthRouter = new Hono();

healthRouter.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: '0.1.0',
    uptimeSeconds: process.uptime(),
    services: {
      database: process.env.DATABASE_URL ? 'healthy' : 'unconfigured',
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
