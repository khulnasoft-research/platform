import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth.js';
import { projectRouter } from './routes/projects.js';
import { aiRouter } from './routes/ai.js';
import { agentRouter } from './routes/agents.js';
import { blueprintRouter } from './routes/blueprints.js';
import { previewRouter } from './routes/previews.js';
import { deployRouter } from './routes/deploys.js';
import { healthRouter } from './routes/health.js';
import { structuredLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { rateLimit } from './middleware/rate-limit.js';

const app = new Hono();

app.use('*', cors({ origin: '*', credentials: true }));

app.use('*', structuredLogger);

app.use('/api/v1/auth/*', rateLimit('auth'));
app.use('/api/v1/ai/*', rateLimit('ai'));
app.use('/api/v1/deploy/*', rateLimit('deploy'));
app.use('/api/v1/previews/*', rateLimit('deploy'));
app.use('/api/v1/*', rateLimit('api'));

app.route('/api/v1/auth', authRouter);
app.route('/api/v1/projects', projectRouter);
app.route('/api/v1/ai', aiRouter);
app.route('/api/v1/agents', agentRouter);
app.route('/api/v1/blueprints', blueprintRouter);
app.route('/api/v1/previews', previewRouter);
app.route('/api/v1/deploy', deployRouter);
app.route('/api/v1', healthRouter);

app.notFound((c) => {
  const requestId = c.get('requestId') || '';
  return c.json({ error: 'Not found', requestId, status: 404 }, 404);
});

app.onError(errorHandler);

const port = parseInt(process.env.PORT || '3001', 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(JSON.stringify({
    level: 'info',
    message: `API server running on http://localhost:${port}`,
    port,
    env: process.env.NODE_ENV || 'development',
  }));
});

export default app;
