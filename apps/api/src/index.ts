import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRouter } from './routes/auth.js';
import { projectRouter } from './routes/projects.js';
import { aiRouter } from './routes/ai.js';
import { agentRouter } from './routes/agents.js';
import { healthRouter } from './routes/health.js';

const app = new Hono();

app.use('*', cors({ origin: '*', credentials: true }));
app.use('*', logger());

app.route('/api/v1/auth', authRouter);
app.route('/api/v1/projects', projectRouter);
app.route('/api/v1/ai', aiRouter);
app.route('/api/v1/agents', agentRouter);
app.route('/api/v1', healthRouter);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = parseInt(process.env.PORT || '3001', 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`API server running on http://localhost:${port}`);
});

export default app;
