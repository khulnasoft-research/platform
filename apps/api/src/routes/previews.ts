import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import { previewEngine } from '../services/preview-engine.js';

export const previewRouter = new Hono();

const createPreviewSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  framework: z.string().default('nextjs'),
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
        type: z.enum(['source', 'config', 'asset']),
        size: z.number(),
        updatedAt: z.string(),
      }),
    )
    .default([]),
});

const updateFilesSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
      type: z.enum(['source', 'config', 'asset']),
      size: z.number(),
      updatedAt: z.string(),
    }),
  ),
});

previewRouter.post('/', zValidator('json', createPreviewSchema), async (c) => {
  const data = c.req.valid('json');
  const session = previewEngine.createSession(data);
  return c.json(session, 201);
});

previewRouter.get('/', async (c) => {
  const projectId = c.req.query('project_id') || undefined;
  const sessions = previewEngine.listSessions(projectId);
  return c.json({ previews: sessions });
});

previewRouter.get('/:id', async (c) => {
  const session = previewEngine.getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Preview session not found' }, 404);
  return c.json(session);
});

previewRouter.post('/:id/stop', async (c) => {
  const session = previewEngine.stopSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Preview session not found' }, 404);
  return c.json(session);
});

previewRouter.get('/:id/logs', async (c) => {
  const since = c.req.query('since') || undefined;
  const logs = previewEngine.getLogs(c.req.param('id'), since);
  return c.json({ logs });
});

previewRouter.get('/:id/logs/stream', async (c) => {
  const session = previewEngine.getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Preview session not found' }, 404);

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastIndex = 0;

      const sendLogs = () => {
        const s = previewEngine.getSession(c.req.param('id'));
        if (!s) return;

        const newLogs = s.buildLogs.slice(lastIndex);
        for (const log of newLogs) {
          controller.enqueue(
            encoder.encode(
              `event: log\ndata: ${JSON.stringify(log)}\n\n`,
            ),
          );
        }
        lastIndex = s.buildLogs.length;

        if (s.status === 'running' || s.status === 'error' || s.status === 'stopped') {
          controller.enqueue(
            encoder.encode(
              `event: status\ndata: ${JSON.stringify({ status: s.status })}\n\n`,
            ),
          );
        }
      };

      sendLogs();
      const interval = setInterval(sendLogs, 500);

      const checkFinished = setInterval(() => {
        const s = previewEngine.getSession(c.req.param('id'));
        if (s && (s.status === 'running' || s.status === 'error' || s.status === 'stopped')) {
          clearInterval(interval);
          clearInterval(checkFinished);
          controller.close();
        }
      }, 1000);
    },
  });

  return c.newResponse(stream);
});

previewRouter.patch('/:id/files', zValidator('json', updateFilesSchema), async (c) => {
  const data = c.req.valid('json');
  const session = previewEngine.updateFiles(c.req.param('id'), data.files);
  if (!session) return c.json({ error: 'Preview session not found' }, 404);
  return c.json(session);
});

previewRouter.get('/:id/metrics', async (c) => {
  const metrics = previewEngine.getMetrics(c.req.param('id'));
  if (!metrics) return c.json({ error: 'Preview session not found' }, 404);
  return c.json(metrics);
});
