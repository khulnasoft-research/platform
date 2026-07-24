import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import { blueprintEngine } from '../services/blueprint-engine.js';

export const blueprintRouter = new Hono();

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    'system', 'service', 'module', 'application', 'page', 'component',
    'api-route', 'server-action', 'database', 'table', 'schema', 'migration',
    'deployment', 'function', 'bucket', 'queue', 'domain', 'interface', 'event',
  ]),
  name: z.string(),
  path: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

const edgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  type: z.enum([
    'contains', 'extends', 'implements', 'imports', 'depends-on', 'uses',
    'calls', 'http-calls', 'emits', 'subscribes', 'reads', 'writes', 'migrates',
    'deploys-to', 'routes-to', 'adheres-to', 'violates',
  ]),
  metadata: z.record(z.unknown()).optional(),
});

const createSnapshotSchema = z.object({
  projectId: z.string().uuid(),
  commitSha: z.string().min(1),
  branch: z.string().min(1),
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(edgeSchema),
  metadata: z.object({
    totalFiles: z.number(),
    totalSymbols: z.number(),
    languageBreakdown: z.record(z.number()),
    frameworkDetected: z.array(z.string()),
    architecturePattern: z.string(),
  }),
});

const impactSchema = z.object({
  change: z.enum(['modify', 'delete', 'rename']),
});

blueprintRouter.post('/', zValidator('json', createSnapshotSchema), async (c) => {
  const data = c.req.valid('json');
  const snapshot = blueprintEngine.createSnapshot(data);

  return c.json(snapshot, 201);
});

blueprintRouter.get('/', async (c) => {
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id required' }, 400);

  const snapshots = blueprintEngine.listSnapshots(projectId);
  return c.json({ snapshots });
});

blueprintRouter.get('/:id', async (c) => {
  const snapshot = blueprintEngine.getSnapshot(c.req.param('id'));
  if (!snapshot) return c.json({ error: 'Snapshot not found' }, 404);
  return c.json(snapshot);
});

blueprintRouter.delete('/:id', async (c) => {
  const deleted = blueprintEngine.deleteSnapshot(c.req.param('id'));
  if (!deleted) return c.json({ error: 'Snapshot not found' }, 404);
  return c.body(null, 204);
});

blueprintRouter.post('/:id/analyze', async (c) => {
  const snapshot = blueprintEngine.getSnapshot(c.req.param('id'));
  if (!snapshot) return c.json({ error: 'Snapshot not found' }, 404);

  const analysis = blueprintEngine.analyzeArchitecture(snapshot);
  return c.json(analysis);
});

blueprintRouter.get('/:id/drift', async (c) => {
  const baselineId = c.req.query('baseline_id');
  if (!baselineId) return c.json({ error: 'baseline_id required' }, 400);

  const baseline = blueprintEngine.getSnapshot(baselineId);
  const current = blueprintEngine.getSnapshot(c.req.param('id'));
  if (!baseline || !current) {
    return c.json({ error: 'One or both snapshots not found' }, 404);
  }

  const findings = blueprintEngine.detectDrift(baseline, current);
  return c.json({ findings });
});

blueprintRouter.post('/:id/impact', zValidator('json', impactSchema), async (c) => {
  const snapshot = blueprintEngine.getSnapshot(c.req.param('id'));
  if (!snapshot) return c.json({ error: 'Snapshot not found' }, 404);

  const { targetNodeId } = c.req.query();
  if (!targetNodeId) return c.json({ error: 'targetNodeId query param required' }, 400);

  const data = c.req.valid('json');
  const impact = blueprintEngine.analyzeImpact(snapshot, targetNodeId, data.change);
  if (!impact) return c.json({ error: 'Target node not found in snapshot' }, 404);

  return c.json(impact);
});
