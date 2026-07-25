import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { blueprintRouter } from '../routes/blueprints.js';
import { db } from '../db/index.js';

const app = new Hono().route('/', blueprintRouter);
const projectId = '00000000-0000-0000-0000-000000000001';

function itIfDb(description: string, fn: () => Promise<void>) {
  if (db.connected) it(description, fn);
}

beforeAll(async () => {
  if (db.connected) {
    await db.query("DELETE FROM blueprint_snapshots WHERE commit_sha LIKE 'int-test-%'");
  }
});

describe('Blueprints Integration', () => {
  const makeSnapshot = (sha: string) => ({
    projectId,
    commitSha: sha,
    branch: 'main',
    nodes: [{ id: 'n1', type: 'service' as const, name: 'API', path: 'apps/api' }],
    edges: [{ id: 'e1', sourceId: 'n1', targetId: 'n1', type: 'contains' as const }],
    metadata: {
      totalFiles: 10,
      totalSymbols: 50,
      languageBreakdown: { typescript: 10 },
      frameworkDetected: ['hono'],
      architecturePattern: 'layered',
    },
  });

  itIfDb('creates snapshot and persists to DB', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeSnapshot('int-test-create')),
    });
    expect(res.status).toBe(201);
    const snapshot = await res.json();

    const row = await db.queryOne('SELECT * FROM blueprint_snapshots WHERE id = $1', [snapshot.id]);
    expect(row).not.toBeNull();
    expect(row?.commit_sha).toBe('int-test-create');
  });

  itIfDb('lists snapshots from DB', async () => {
    await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeSnapshot('int-test-list')),
    });

    const res = await app.request(`/?project_id=${projectId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.snapshots)).toBe(true);
    const match = body.snapshots.find((s: { commitSha: string }) => s.commitSha === 'int-test-list');
    expect(match).toBeDefined();
  });

  itIfDb('gets snapshot by ID from DB', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeSnapshot('int-test-get')),
    });
    const snapshot = await createRes.json();

    const res = await app.request(`/${snapshot.id}`);
    expect(res.status).toBe(200);
    expect((await res.json()).commitSha).toBe('int-test-get');
  });

  itIfDb('deletes snapshot from DB', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeSnapshot('int-test-delete')),
    });
    const snapshot = await createRes.json();

    const res = await app.request(`/${snapshot.id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);

    const row = await db.queryOne('SELECT id FROM blueprint_snapshots WHERE id = $1', [snapshot.id]);
    expect(row).toBeNull();
  });

  itIfDb('analyzes architecture from DB snapshot', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeSnapshot('int-test-analyze')),
    });
    const snapshot = await createRes.json();

    const res = await app.request(`/${snapshot.id}/analyze`, { method: 'POST' });
    expect(res.status).toBe(200);
    const analysis = await res.json();
    expect(analysis.pattern).toBeDefined();
    expect(analysis.recommendations).toBeDefined();
  });
});
