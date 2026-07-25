import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { deployRouter } from '../routes/deploys.js';
import { db } from '../db/index.js';

const app = new Hono().route('/', deployRouter);
const projectId = '00000000-0000-0000-0000-000000000001';

function itIfDb(description: string, fn: () => Promise<void>) {
  if (db.connected) it(description, fn);
}

beforeAll(async () => {
  if (db.connected) {
    await db.query("DELETE FROM deployment_environments WHERE name LIKE 'int-test-%'");
    await db.query("DELETE FROM deployments WHERE commit_sha LIKE 'int-test-%'");
  }
});

describe('Deploy Integration', () => {
  itIfDb('creates environment and persists to DB', async () => {
    const res = await app.request('/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name: 'int-test-env',
        type: 'persistent',
        provider: 'vercel',
      }),
    });
    expect(res.status).toBe(201);
    const env = await res.json();

    const row = await db.queryOne('SELECT * FROM deployment_environments WHERE id = $1', [env.id]);
    expect(row).not.toBeNull();
    expect(row?.name).toBe('int-test-env');
  });

  itIfDb('lists environments from DB', async () => {
    const res = await app.request(`/environments?project_id=${projectId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.environments)).toBe(true);
    const match = body.environments.find((e: { name: string }) => e.name === 'int-test-env');
    expect(match).toBeDefined();
  });

  itIfDb('gets environment by ID from DB', async () => {
    const createRes = await app.request('/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name: 'int-test-env-get',
        type: 'persistent',
        provider: 'railway',
      }),
    });
    const env = await createRes.json();

    const res = await app.request(`/environments/${env.id}`);
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('int-test-env-get');
  });

  itIfDb('sets env vars in DB', async () => {
    const createRes = await app.request('/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name: 'int-test-env-vars',
        type: 'persistent',
        provider: 'railway',
      }),
    });
    const env = await createRes.json();

    const res = await app.request(`/environments/${env.id}/env-vars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envVars: ['KEY=value', 'DB_URL=postgres://db'] }),
    });
    expect(res.status).toBe(200);

    const row = await db.queryOne('SELECT env_vars FROM deployment_environments WHERE id = $1', [env.id]);
    expect(row?.env_vars).toContain('KEY=value');
  });

  itIfDb('removes env vars in DB', async () => {
    const createRes = await app.request('/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name: 'int-test-env-rm',
        type: 'persistent',
        provider: 'railway',
      }),
    });
    const env = await createRes.json();

    await app.request(`/environments/${env.id}/env-vars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envVars: ['KEY=value', 'OTHER=val'] }),
    });

    const res = await app.request(`/environments/${env.id}/env-vars`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: ['KEY'] }),
    });
    expect(res.status).toBe(200);

    const row = await db.queryOne('SELECT env_vars FROM deployment_environments WHERE id = $1', [env.id]);
    expect(row?.env_vars).not.toContain('KEY=value');
    expect(row?.env_vars).toContain('OTHER=val');
  });

  itIfDb('deletes environment from DB', async () => {
    const createRes = await app.request('/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name: 'int-test-env-del',
        type: 'persistent',
        provider: 'vercel',
      }),
    });
    const env = await createRes.json();

    const res = await app.request(`/environments/${env.id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);

    const row = await db.queryOne('SELECT id FROM deployment_environments WHERE id = $1', [env.id]);
    expect(row).toBeNull();
  });

  itIfDb('creates deployment and persists to DB', async () => {
    const envRes = await app.request('/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name: `int-test-dep-env-${Date.now()}`,
        type: 'persistent',
        provider: 'vercel',
      }),
    });
    const env = await envRes.json();

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        environmentId: env.id,
        commitSha: 'int-test-deploy',
        provider: 'vercel',
      }),
    });
    expect(res.status).toBe(201);
    const dep = await res.json();

    const row = await db.queryOne('SELECT * FROM deployments WHERE id = $1', [dep.id]);
    expect(row).not.toBeNull();
    expect(row?.commit_sha).toBe('int-test-deploy');
  });

  itIfDb('lists deployments from DB', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.deployments)).toBe(true);
    const match = body.deployments.find((d: { commitSha: string }) => d.commitSha === 'int-test-deploy');
    expect(match).toBeDefined();
  });

  itIfDb('rolls back deployment in DB', async () => {
    const envRes = await app.request('/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name: `int-test-rb-env-${Date.now()}`,
        type: 'persistent',
        provider: 'vercel',
      }),
    });
    const env = await envRes.json();

    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        environmentId: env.id,
        commitSha: 'int-test-rollback',
        provider: 'vercel',
      }),
    });
    const dep = await createRes.json();

    dep.status = 'live';
    await db.query(`UPDATE deployments SET status = 'live' WHERE id = $1`, [dep.id]);

    const res = await app.request(`/${dep.id}/rollback`, { method: 'POST' });
    expect(res.status).toBe(200);

    const row = await db.queryOne('SELECT status FROM deployments WHERE id = $1', [dep.id]);
    expect(row?.status).toBe('rolled-back');
  });
});
