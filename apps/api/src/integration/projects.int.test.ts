import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { projectRouter } from '../routes/projects.js';
import { db } from '../db/index.js';
import { authService } from '../services/auth-service.js';

const app = new Hono().route('/projects', projectRouter);
let token: string;
let orgId: string;

function itIfDb(description: string, fn: () => Promise<void>) {
  if (db.connected) it(description, fn);
}

beforeAll(async () => {
  if (!db.connected) return;

  await db.query("DELETE FROM projects WHERE name LIKE 'int-test-%'");

  const row = await db.queryOne<{ id: string }>(
    `INSERT INTO organizations (id, name, slug, plan, created_at)
     VALUES (gen_random_uuid(), 'Int Test Org', 'int-test-org', 'free', now())
     RETURNING id`,
  );
  orgId = row?.id ?? '';

  const email = `int-test-proj-${Date.now()}@example.com`;
  const reg = await authService.register({ email, password: 'password123', name: 'Proj Test' });
  token = reg.token;
});

describe('Projects Integration', () => {
  itIfDb('creates project and persists to DB', async () => {
    const res = await app.request('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'int-test-project',
        description: 'Integration test project',
        organizationId: orgId,
      }),
    });
    expect(res.status).toBe(201);
    const project = await res.json();

    const row = await db.queryOne('SELECT * FROM projects WHERE id = $1', [project.id]);
    expect(row).not.toBeNull();
    expect(row?.name).toBe('int-test-project');
  });

  itIfDb('lists projects from DB', async () => {
    const res = await app.request(`/projects?organization_id=${orgId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.projects)).toBe(true);
    const match = body.projects.find((p: { name: string }) => p.name === 'int-test-project');
    expect(match).toBeDefined();
  });

  itIfDb('updates project in DB', async () => {
    const createRes = await app.request('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'int-test-update',
        organizationId: orgId,
      }),
    });
    const project = await createRes.json();

    const res = await app.request(`/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'int-test-updated', description: 'Updated desc' }),
    });
    expect(res.status).toBe(200);

    const row = await db.queryOne('SELECT * FROM projects WHERE id = $1', [project.id]);
    expect(row?.name).toBe('int-test-updated');
    expect(row?.description).toBe('Updated desc');
  });

  itIfDb('soft-deletes project in DB', async () => {
    const createRes = await app.request('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'int-test-delete',
        organizationId: orgId,
      }),
    });
    const project = await createRes.json();

    const res = await app.request(`/projects/${project.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(204);

    const row = await db.queryOne('SELECT * FROM projects WHERE id = $1', [project.id]);
    expect(row?.archived_at).not.toBeNull();
  });
});
