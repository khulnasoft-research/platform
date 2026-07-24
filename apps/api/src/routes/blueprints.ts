import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { blueprintEngine } from '../services/blueprint-engine.js';
import type { BlueprintSnapshot } from '@platform/shared-types';

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

function toSnapshot(row: any): BlueprintSnapshot {
  return {
    id: row.id,
    projectId: row.project_id,
    commitSha: row.commit_sha,
    branch: row.branch,
    nodes: row.nodes ?? [],
    edges: row.edges ?? [],
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

blueprintRouter.post('/', zValidator('json', createSnapshotSchema), async (c) => {
  const data = c.req.valid('json');
  const snapshot = blueprintEngine.createSnapshot(data);

  if (db.connected) {
    await db.query(
      `INSERT INTO blueprint_snapshots (id, project_id, commit_sha, branch, nodes, edges, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [snapshot.id, snapshot.projectId, snapshot.commitSha, snapshot.branch,
       JSON.stringify(snapshot.nodes), JSON.stringify(snapshot.edges),
       JSON.stringify(snapshot.metadata), snapshot.createdAt],
    );
  }

  return c.json(snapshot, 201);
});

blueprintRouter.get('/', async (c) => {
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id required' }, 400);

  if (db.connected) {
    const rows = await db.query(
      'SELECT * FROM blueprint_snapshots WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId],
    );
    return c.json({ snapshots: (rows ?? []).map(toSnapshot) });
  }

  const snapshots = blueprintEngine.listSnapshots(projectId);
  return c.json({ snapshots });
});

blueprintRouter.get('/:id', async (c) => {
  if (db.connected) {
    const row = await db.queryOne('SELECT * FROM blueprint_snapshots WHERE id = $1', [c.req.param('id')]);
    if (row) return c.json(toSnapshot(row));
  }

  const snapshot = blueprintEngine.getSnapshot(c.req.param('id'));
  if (!snapshot) return c.json({ error: 'Snapshot not found' }, 404);
  return c.json(snapshot);
});

blueprintRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  if (db.connected) {
    const row = await db.queryOne('DELETE FROM blueprint_snapshots WHERE id = $1 RETURNING id', [id]);
    if (row) return c.body(null, 204);
    return c.json({ error: 'Snapshot not found' }, 404);
  }

  const deleted = blueprintEngine.deleteSnapshot(id);
  if (!deleted) return c.json({ error: 'Snapshot not found' }, 404);
  return c.body(null, 204);
});

blueprintRouter.post('/:id/analyze', async (c) => {
  let snapshot: BlueprintSnapshot | null | undefined;

  if (db.connected) {
    const row = await db.queryOne('SELECT * FROM blueprint_snapshots WHERE id = $1', [c.req.param('id')]);
    if (row) snapshot = toSnapshot(row);
  } else {
    snapshot = blueprintEngine.getSnapshot(c.req.param('id'));
  }

  if (!snapshot) return c.json({ error: 'Snapshot not found' }, 404);
  const analysis = blueprintEngine.analyzeArchitecture(snapshot);
  return c.json(analysis);
});

blueprintRouter.get('/:id/drift', async (c) => {
  const baselineId = c.req.query('baseline_id');
  if (!baselineId) return c.json({ error: 'baseline_id required' }, 400);

  let baseline: BlueprintSnapshot | null | undefined;
  let current: BlueprintSnapshot | null | undefined;

  if (db.connected) {
    const [baselineRow, currentRow] = await Promise.all([
      db.queryOne('SELECT * FROM blueprint_snapshots WHERE id = $1', [baselineId]),
      db.queryOne('SELECT * FROM blueprint_snapshots WHERE id = $1', [c.req.param('id')]),
    ]);
    if (baselineRow) baseline = toSnapshot(baselineRow);
    if (currentRow) current = toSnapshot(currentRow);
  } else {
    baseline = blueprintEngine.getSnapshot(baselineId);
    current = blueprintEngine.getSnapshot(c.req.param('id'));
  }

  if (!baseline || !current) {
    return c.json({ error: 'One or both snapshots not found' }, 404);
  }

  const findings = blueprintEngine.detectDrift(baseline, current);
  return c.json({ findings });
});

blueprintRouter.post('/:id/impact', zValidator('json', impactSchema), async (c) => {
  const { targetNodeId } = c.req.query();
  if (!targetNodeId) return c.json({ error: 'targetNodeId query param required' }, 400);

  let snapshot: BlueprintSnapshot | null | undefined;

  if (db.connected) {
    const row = await db.queryOne('SELECT * FROM blueprint_snapshots WHERE id = $1', [c.req.param('id')]);
    if (row) snapshot = toSnapshot(row);
  } else {
    snapshot = blueprintEngine.getSnapshot(c.req.param('id'));
  }

  if (!snapshot) return c.json({ error: 'Snapshot not found' }, 404);

  const data = c.req.valid('json');
  const impact = blueprintEngine.analyzeImpact(snapshot, targetNodeId, data.change);
  if (!impact) return c.json({ error: 'Target node not found in snapshot' }, 404);

  return c.json(impact);
});
