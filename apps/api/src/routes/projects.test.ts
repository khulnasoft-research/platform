import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { projectRouter } from './projects.js';

const app = new Hono().route('/projects', projectRouter);

describe('Projects CRUD', () => {
  let projectId: string;

  it('rejects list without organization_id', async () => {
    const res = await app.request('/projects');
    expect(res.status).toBe(400);
  });

  it('creates a project', async () => {
    const res = await app.request('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Project',
        description: 'A test project',
        organizationId: '00000000-0000-0000-0000-000000000001',
      }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.name).toBe('Test Project');
    expect(body.description).toBe('A test project');
    expect(body.aiConfig).toBeDefined();
    projectId = body.id;
  });

  it('lists projects by organization', async () => {
    const res = await app.request(
      '/projects?organization_id=00000000-0000-0000-0000-000000000001',
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]!.id).toBe(projectId);
  });

  it('gets a project by id', async () => {
    const res = await app.request(`/projects/${projectId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(projectId);
  });

  it('returns 404 for unknown project', async () => {
    const res = await app.request(
      '/projects/00000000-0000-0000-0000-000000009999',
    );
    expect(res.status).toBe(404);
  });

  it('updates a project', async () => {
    const res = await app.request(`/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Project' }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe('Updated Project');
  });

  it('deletes a project', async () => {
    const res = await app.request(`/projects/${projectId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);

    const check = await app.request(`/projects/${projectId}`);
    expect(check.status).toBe(404);
  });
});
