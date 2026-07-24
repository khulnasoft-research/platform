import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import type { Task } from '@platform/shared-types';

export const agentRouter = new Hono();

const tasks = new Map<string, Task>();

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  goal: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

// GET /agents/tasks
agentRouter.get('/tasks', async (c) => {
  const projectId = c.req.query('project_id');
  if (projectId) {
    return c.json({
      tasks: Array.from(tasks.values()).filter((t) => t.projectId === projectId),
    });
  }
  return c.json({ tasks: Array.from(tasks.values()) });
});

// POST /agents/tasks
agentRouter.post('/tasks', zValidator('json', createTaskSchema), async (c) => {
  const data = c.req.valid('json');

  const task: Task = {
    id: crypto.randomUUID(),
    projectId: data.projectId,
    dependencies: [],
    assignee: 'planner',
    goal: data.goal,
    priority: data.priority,
    status: 'queued',
    plan: null,
    result: null,
    budget: {
      monthlyLimit: 1000000,
      dailyLimit: 100000,
      perRequestLimit: 10000,
      costLimit: 10.0,
    },
    approvalGates: [],
    createdAt: new Date().toISOString(),
  };

  tasks.set(task.id, task);
  return c.json(task, 201);
});

// GET /agents/tasks/:id
agentRouter.get('/tasks/:id', async (c) => {
  const task = tasks.get(c.req.param('id'));
  if (!task) return c.json({ error: 'Task not found' }, 404);
  return c.json(task);
});

// POST /agents/tasks/:id/cancel
agentRouter.post('/tasks/:id/cancel', async (c) => {
  const task = tasks.get(c.req.param('id'));
  if (!task) return c.json({ error: 'Task not found' }, 404);
  task.status = 'cancelled';
  tasks.set(task.id, task);
  return c.json(task);
});
