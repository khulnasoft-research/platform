import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { blueprintRouter } from './blueprints.js';

const app = new Hono().route('/blueprints', blueprintRouter);

const sampleNodes = [
  {
    id: 'node-1',
    type: 'api-route' as const,
    name: 'users.ts',
    path: 'src/api/users.ts',
    metadata: {},
  },
  {
    id: 'node-2',
    type: 'component' as const,
    name: 'UserList.tsx',
    path: 'src/components/UserList.tsx',
    metadata: {},
  },
  {
    id: 'node-3',
    type: 'page' as const,
    name: 'users/page.tsx',
    path: 'src/app/users/page.tsx',
    metadata: {},
  },
  {
    id: 'node-4',
    type: 'database' as const,
    name: 'Postgres',
    path: null,
    metadata: {},
  },
];

const sampleEdges = [
  {
    id: 'edge-1',
    sourceId: 'node-1',
    targetId: 'node-4',
    type: 'reads' as const,
  },
  {
    id: 'edge-2',
    sourceId: 'node-2',
    targetId: 'node-1',
    type: 'calls' as const,
  },
];

const sampleMeta = {
  totalFiles: 42,
  totalSymbols: 156,
  languageBreakdown: { typescript: 30, javascript: 12 },
  frameworkDetected: ['nextjs'],
  architecturePattern: 'fullstack',
};

function createSnapshot() {
  return app.request('/blueprints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: '00000000-0000-0000-0000-000000000001',
      commitSha: 'abc123',
      branch: 'main',
      nodes: sampleNodes,
      edges: sampleEdges,
      metadata: sampleMeta,
    }),
  });
}

describe('Blueprints CRUD', () => {
  let snapshotId: string;

  it('creates a blueprint snapshot', async () => {
    const res = await createSnapshot();
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.projectId).toBe('00000000-0000-0000-0000-000000000001');
    expect(body.commitSha).toBe('abc123');
    expect(body.nodes).toHaveLength(4);
    expect(body.edges).toHaveLength(2);
    snapshotId = body.id;
  });

  it('lists snapshots by project', async () => {
    const res = await app.request(
      '/blueprints?project_id=00000000-0000-0000-0000-000000000001',
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.snapshots).toHaveLength(1);
    expect(body.snapshots[0]?.id).toBe(snapshotId);
  });

  it('requires project_id for list', async () => {
    const res = await app.request('/blueprints');
    expect(res.status).toBe(400);
  });

  it('gets a snapshot by id', async () => {
    const res = await app.request(`/blueprints/${snapshotId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(snapshotId);
  });

  it('returns 404 for unknown snapshot', async () => {
    const res = await app.request(
      '/blueprints/00000000-0000-0000-0000-000000009999',
    );
    expect(res.status).toBe(404);
  });

  it('deletes a snapshot', async () => {
    const res = await app.request(`/blueprints/${snapshotId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);

    const check = await app.request(`/blueprints/${snapshotId}`);
    expect(check.status).toBe(404);
  });
});

describe('Blueprint Analysis', () => {
  let snapshotId: string;

  beforeAll(async () => {
    const res = await createSnapshot();
    const body = await res.json();
    snapshotId = body.id;
  });

  it('analyzes architecture', async () => {
    const res = await app.request(`/blueprints/${snapshotId}/analyze`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.pattern).toBe('Full-stack web application');
    expect(body.recommendations.length).toBeGreaterThan(0);
  });

  it('detects drift between two snapshots', async () => {
    const res1 = await createSnapshot();
    const s1 = await res1.json();

    const res2 = await app.request('/blueprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '00000000-0000-0000-0000-000000000001',
        commitSha: 'def456',
        branch: 'feature',
        nodes: sampleNodes.slice(0, 2),
        edges: sampleEdges.slice(0, 1),
        metadata: sampleMeta,
      }),
    });
    const s2 = await res2.json();

    const driftRes = await app.request(
      `/blueprints/${s2.id}/drift?baseline_id=${s1.id}`,
    );
    expect(driftRes.status).toBe(200);

    const drift = await driftRes.json();
    expect(drift.findings.length).toBeGreaterThan(0);
  });

  it('requires baseline_id for drift', async () => {
    const res = await app.request(`/blueprints/${snapshotId}/drift`);
    expect(res.status).toBe(400);
  });

  it('analyzes impact of deleting a node', async () => {
    const res = await app.request(
      `/blueprints/${snapshotId}/impact?targetNodeId=node-1`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change: 'delete' }),
      },
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.target).toBe('users.ts');
    expect(body.change).toBe('delete');
    expect(body.risk).toBe('high');
    expect(body.directImpact.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown target node in impact', async () => {
    const res = await app.request(
      `/blueprints/${snapshotId}/impact?targetNodeId=nonexistent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change: 'modify' }),
      },
    );
    expect(res.status).toBe(404);
  });
});
