import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';
import type { Project } from '@platform/shared-types';

export const projectRouter = new Hono();

const projects = new Map<string, Project>();

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  organizationId: z.string().uuid(),
  repositoryUrl: z.string().url().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});

projectRouter.use('*', requireAuth);

projectRouter.get('/', async (c) => {
  const orgId = c.req.query('organization_id');
  if (!orgId) return c.json({ error: 'organization_id required' }, 400);

  if (db.connected) {
    const rows = await db.query<Project>(
      'SELECT * FROM projects WHERE organization_id = $1 AND archived_at IS NULL ORDER BY created_at DESC',
      [orgId],
    );
    return c.json({ projects: rows ?? [] });
  }

  const list = Array.from(projects.values()).filter(
    (p) => p.organizationId === orgId,
  );
  return c.json({ projects: list });
});

projectRouter.post('/', zValidator('json', createProjectSchema), async (c) => {
  const data = c.req.valid('json');

  if (db.connected) {
    const project = await db.queryOne<Project>(
      `INSERT INTO projects (name, description, organization_id, repository_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, name, description, organization_id as "organizationId",
         repository_url as "repository", null as framework, null as "aiConfig",
         created_at as "createdAt", updated_at as "updatedAt", null as "archivedAt"`,
      [data.name, data.description ?? null, data.organizationId, data.repositoryUrl ?? null],
    );
    if (project) return c.json(project, 201);
  }

  const project: Project = {
    id: crypto.randomUUID(),
    name: data.name,
    description: data.description ?? null,
    organizationId: data.organizationId,
    repository: data.repositoryUrl
      ? { provider: 'github', url: data.repositoryUrl, defaultBranch: 'main' }
      : null,
    framework: null,
    aiConfig: {
      defaultModel: 'claude-sonnet-4',
      agents: [],
      knowledgeBases: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  };

  projects.set(project.id, project);
  return c.json(project, 201);
});

projectRouter.get('/:id', async (c) => {
  if (db.connected) {
    const project = await db.queryOne<Project>(
      'SELECT * FROM projects WHERE id = $1',
      [c.req.param('id')],
    );
    if (project) return c.json(project);
  }

  const project = projects.get(c.req.param('id'));
  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json(project);
});

projectRouter.patch('/:id', zValidator('json', updateProjectSchema), async (c) => {
  const data = c.req.valid('json');
  const id = c.req.param('id');

  if (db.connected) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.name) { sets.push(`name = $${idx++}`); params.push(data.name); }
    if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
    sets.push(`updated_at = now()`);
    params.push(id);

    const project = await db.queryOne<Project>(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, name, description, organization_id as "organizationId",
         repository_url as "repository", framework, null as "aiConfig",
         created_at as "createdAt", updated_at as "updatedAt", archived_at as "archivedAt"`,
      params,
    );
    if (project) return c.json(project);
  }

  const project = projects.get(id);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const updated: Project = {
    ...project,
    ...(data.name && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
    updatedAt: new Date().toISOString(),
  };

  projects.set(project.id, updated);
  return c.json(updated);
});

projectRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  if (db.connected) {
    const result = await db.query('UPDATE projects SET archived_at = now() WHERE id = $1', [id]);
    if (result && result.length > 0) return c.body(null, 204);
  }

  const deleted = projects.delete(id);
  if (!deleted) return c.json({ error: 'Project not found' }, 404);
  return c.body(null, 204);
});
