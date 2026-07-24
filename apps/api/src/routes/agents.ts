import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import type { Task } from '@platform/shared-types';
import { agentRuntime } from '../services/agent-runtime.js';

export const agentRouter = new Hono();

const tasks = new Map<string, Task>();

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  goal: z.string().min(1),
  assignee: z
    .enum([
      'architect', 'planner', 'frontend', 'backend', 'database',
      'infrastructure', 'security', 'tester', 'documentarian', 'reviewer',
      'release-manager',
    ])
    .default('planner'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  approvalGates: z
    .array(z.enum(['destructive', 'deployment', 'schema-change', 'dependency', 'security']))
    .optional(),
});

const approveGateSchema = z.object({
  approved: z.boolean(),
  userId: z.string().optional(),
  notes: z.string().optional(),
});

agentRouter.get('/tasks', async (c) => {
  const projectId = c.req.query('project_id');
  if (projectId) {
    return c.json({
      tasks: Array.from(tasks.values()).filter((t) => t.projectId === projectId),
    });
  }
  return c.json({ tasks: Array.from(tasks.values()) });
});

agentRouter.post('/tasks', zValidator('json', createTaskSchema), async (c) => {
  const data = c.req.valid('json');

  const gateTypes = data.approvalGates ?? [];
  const task: Task = {
    id: crypto.randomUUID(),
    projectId: data.projectId,
    dependencies: [],
    assignee: data.assignee,
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
    approvalGates: gateTypes.map((type: string) => ({
      id: crypto.randomUUID(),
      type,
      status: 'pending' as const,
    })),
    createdAt: new Date().toISOString(),
  };

  tasks.set(task.id, task);

  const submitted = await agentRuntime.submitTask(task);
  tasks.set(task.id, submitted);

  return c.json(submitted, 201);
});

agentRouter.get('/tasks/:id', async (c) => {
  const task = tasks.get(c.req.param('id'));
  if (!task) return c.json({ error: 'Task not found' }, 404);
  return c.json(task);
});

agentRouter.post('/tasks/:id/cancel', async (c) => {
  const task = tasks.get(c.req.param('id'));
  if (!task) return c.json({ error: 'Task not found' }, 404);
  task.status = 'cancelled';
  tasks.set(task.id, task);
  return c.json(task);
});

agentRouter.post('/tasks/:id/plan', async (c) => {
  const task = tasks.get(c.req.param('id'));
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.plan) return c.json({ error: 'Task already has a plan' }, 409);

  const plan = await agentRuntime.createPlan(task);
  task.plan = plan;
  tasks.set(task.id, task);
  return c.json(plan);
});

agentRouter.post('/tasks/:id/approve/:gateId', zValidator('json', approveGateSchema), async (c) => {
  const task = tasks.get(c.req.param('id'));
  if (!task) return c.json({ error: 'Task not found' }, 404);

  const data = c.req.valid('json');
  const updated = await agentRuntime.approveGate(task, c.req.param('gateId'), data.approved, data.userId, data.notes);
  tasks.set(task.id, updated);
  return c.json(updated);
});

agentRouter.get('/agents', (c) => {
  return c.json({ agents: agentRuntime.getAgents() });
});

agentRouter.get('/tools', (c) => {
  return c.json({ tools: agentRuntime.getTools() });
});
