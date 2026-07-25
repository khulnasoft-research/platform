import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import { db } from '../db/index.js';
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

  if (db.connected) {
    await db.query(
      `INSERT INTO preview_sessions (id, project_id, task_id, status, url, framework, build_logs, files, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [session.id, session.projectId, session.taskId, session.status, session.url,
       session.framework, JSON.stringify(session.buildLogs), JSON.stringify(session.files), session.createdAt],
    );
  }

  return c.json(session, 201);
});

previewRouter.get('/', async (c) => {
  const projectId = c.req.query('project_id') || undefined;

  if (db.connected) {
    const rows = projectId
      ? await db.query('SELECT * FROM preview_sessions WHERE project_id = $1 ORDER BY created_at DESC', [projectId])
      : await db.query('SELECT * FROM preview_sessions ORDER BY created_at DESC');
    const sessions = (rows ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      projectId: row.project_id as string,
      taskId: row.task_id as string,
      status: row.status as string,
      url: row.url as string,
      framework: row.framework as string,
      buildLogs: (row.build_logs as unknown[]) ?? [],
      files: (row.files as unknown[]) ?? [],
      createdAt: row.created_at as string,
    }));
    return c.json({ previews: sessions });
  }

  const sessions = previewEngine.listSessions(projectId);
  return c.json({ previews: sessions });
});

previewRouter.get('/:id', async (c) => {
  if (db.connected) {
    const row = await db.queryOne('SELECT * FROM preview_sessions WHERE id = $1', [c.req.param('id')]);
    if (row) {
      return c.json({
        id: row.id,
        projectId: row.project_id,
        taskId: row.task_id,
        status: row.status,
        url: row.url,
        framework: row.framework,
        buildLogs: row.build_logs ?? [],
        files: row.files ?? [],
        createdAt: row.created_at,
      });
    }
  }

  const session = previewEngine.getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Preview session not found' }, 404);
  return c.json(session);
});

previewRouter.post('/:id/stop', async (c) => {
  const session = previewEngine.stopSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Preview session not found' }, 404);

  if (db.connected) {
    await db.query(
      `UPDATE preview_sessions SET status = $1, stopped_at = now() WHERE id = $2`,
      [session.status, c.req.param('id')],
    );
  }

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

  if (db.connected) {
    await db.query(
      `UPDATE preview_sessions SET files = $1 WHERE id = $2`,
      [JSON.stringify(session.files), c.req.param('id')],
    );
  }

  return c.json(session);
});

previewRouter.get('/:id/metrics', async (c) => {
  const metrics = previewEngine.getMetrics(c.req.param('id'));
  if (!metrics) return c.json({ error: 'Preview session not found' }, 404);
  return c.json(metrics);
});
