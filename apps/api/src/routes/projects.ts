import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
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

// GET /projects
projectRouter.get('/', async (c) => {
  const orgId = c.req.query('organization_id');
  if (!orgId) return c.json({ error: 'organization_id required' }, 400);

  const list = Array.from(projects.values()).filter(
    (p) => p.organizationId === orgId,
  );
  return c.json({ projects: list });
});

// POST /projects
projectRouter.post('/', zValidator('json', createProjectSchema), async (c) => {
  const data = c.req.valid('json');

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

// GET /projects/:id
projectRouter.get('/:id', async (c) => {
  const project = projects.get(c.req.param('id'));
  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json(project);
});

// PATCH /projects/:id
projectRouter.patch('/:id', zValidator('json', updateProjectSchema), async (c) => {
  const project = projects.get(c.req.param('id'));
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const data = c.req.valid('json');
  const updated: Project = {
    ...project,
    ...(data.name && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
    updatedAt: new Date().toISOString(),
  };

  projects.set(project.id, updated);
  return c.json(updated);
});

// DELETE /projects/:id
projectRouter.delete('/:id', async (c) => {
  const deleted = projects.delete(c.req.param('id'));
  if (!deleted) return c.json({ error: 'Project not found' }, 404);
  return c.body(null, 204);
});
