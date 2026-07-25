import { createServer } from 'node:http';
import { Hono } from 'hono';
import { WebSocketServer } from 'ws';
import { cors } from 'hono/cors';
import { getRequestListener } from '@hono/node-server';
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
import { loadEnterpriseState } from './services/enterprise-store.js';
import { handleWebSocket } from './services/ws-handler.js';

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

loadEnterpriseState().then(() => {
  console.log(JSON.stringify({ level: 'info', message: 'Enterprise state loaded' }));
}).catch((err) => {
  console.error(JSON.stringify({ level: 'warn', message: 'Failed to load enterprise state', error: (err as Error).message }));
});

const port = parseInt(process.env.PORT || '3001', 10);
const server = createServer(getRequestListener(app.fetch));

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', handleWebSocket);

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, '0.0.0.0', () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? addr : `http://${addr?.address || '0.0.0.0'}:${addr?.port || port}`;
  console.log(JSON.stringify({
    level: 'info',
    message: `API server running on ${bind}`,
    port,
    env: process.env.NODE_ENV || 'development',
  }));
});
