import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { deployRouter } from './deploys.js';

const app = new Hono().route('/deploy', deployRouter);

const projectId = '00000000-0000-0000-0000-000000000001';

describe('Providers', () => {
  it('lists all providers', async () => {
    const res = await app.request('/deploy/providers');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.providers.length).toBe(5);
    expect(body.providers[0]?.name).toBe('vercel');
    expect(body.providers[0]?.type).toBe('serverless');
  });

  it('gets provider details', async () => {
    const res = await app.request('/deploy/providers/railway');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe('railway');
    expect(body.regions).toContain('us-west');
  });

  it('returns 404 for unknown provider', async () => {
    const res = await app.request('/deploy/providers/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('Environments CRUD', () => {
  let envId: string;

  it('creates an environment', async () => {
    const res = await app.request('/deploy/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name: 'production',
        type: 'persistent',
        provider: 'vercel',
        domain: 'app.example.com',
      }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.name).toBe('production');
    expect(body.provider).toBe('vercel');
    expect(body.type).toBe('persistent');
    expect(body.compute).toBeDefined();
    expect(body.scaling).toBeDefined();
    expect(body.ssl).toBe(true);
    envId = body.id;
  });

  it('lists environments by project', async () => {
    const res = await app.request(`/deploy/environments?project_id=${projectId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.environments).toHaveLength(1);
    expect(body.environments[0]?.id).toBe(envId);
  });

  it('requires project_id for list', async () => {
    const res = await app.request('/deploy/environments');
    expect(res.status).toBe(400);
  });

  it('gets an environment by id', async () => {
    const res = await app.request(`/deploy/environments/${envId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(envId);
  });

  it('deletes an environment', async () => {
    const res = await app.request(`/deploy/environments/${envId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);
  });
});

describe('Deployments lifecycle', () => {
  let envId: string;
  let deployId: string;

  beforeAll(async () => {
    const res = await app.request('/deploy/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name: 'staging',
        type: 'ephemeral',
        provider: 'railway',
        domain: 'staging.example.com',
      }),
    });
    const body = await res.json();
    envId = body.id;
  });

  it('creates a deployment', async () => {
    const res = await app.request('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        environmentId: envId,
        commitSha: 'a1b2c3d4',
        provider: 'railway',
        deployConfig: {
          buildCommand: 'npm run build',
          outputDir: 'dist',
          installCommand: 'npm ci',
          nodeVersion: '22',
        },
      }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.status).toBe('queued');
    expect(body.provider).toBe('railway');
    expect(body.buildNumber).toBeGreaterThan(0);
    expect(body.url).toContain('staging.example.com');
    deployId = body.id;
  });

  it('lists deployments', async () => {
    const res = await app.request(`/deploy?project_id=${projectId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.deployments.length).toBe(1);
    expect(body.deployments[0]?.id).toBe(deployId);
  });

  it('transitions to live after build', { timeout: 15000 }, async () => {
    await new Promise((r) => setTimeout(r, 6500));

    const res = await app.request(`/deploy/${deployId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('live');
    expect(body.logs.length).toBeGreaterThan(5);

    const hasBuildLog = body.logs.some((l: { message: string }) => l.message.toLowerCase().includes('installed'));
    expect(hasBuildLog).toBe(true);
  });

  it('returns artifact after deployment', async () => {
    const res = await app.request(`/deploy/${deployId}/artifact`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe('static');
    expect(body.size).toBeGreaterThan(0);
    expect(body.sbom).toBeDefined();
  });

  it('returns deployment logs', async () => {
    const res = await app.request(`/deploy/${deployId}/logs`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.logs.length).toBeGreaterThan(0);
    expect(body.logs[0]?.source).toBeDefined();
  });

  it('rolls back a live deployment', async () => {
    const res = await app.request(`/deploy/${deployId}/rollback`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('rolled-back');
  });

  it('rejects rollback on non-live deployment', async () => {
    const res = await app.request(`/deploy/${deployId}/rollback`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });
});

describe('Environment variables', () => {
  let envId: string;

  beforeAll(async () => {
    const res = await app.request('/deploy/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name: 'dev',
        type: 'persistent',
        provider: 'fly-io',
      }),
    });
    const body = await res.json();
    envId = body.id;
  });

  it('adds env vars', async () => {
    const res = await app.request(`/deploy/environments/${envId}/env-vars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        envVars: ['DATABASE_URL=postgres://...', 'API_KEY=sk-...'],
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.envVars).toHaveLength(2);
    expect(body.envVars[0]).toBe('DATABASE_URL=postgres://...');
  });

  it('removes env vars', async () => {
    const res = await app.request(`/deploy/environments/${envId}/env-vars`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: ['DATABASE_URL'] }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.envVars).toHaveLength(1);
    expect(body.envVars[0]).toBe('API_KEY=sk-...');
  });
});

describe('Deploy stats', () => {
  it('returns overview stats', async () => {
    const res = await app.request('/deploy/stats/overview');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalDeployments).toBeGreaterThanOrEqual(0);
    expect(body.byProvider.length).toBe(5);
  });
});
