import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '../middleware/validate.js';
import { db } from '../db/index.js';
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

function toTask(row: any): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    dependencies: [],
    goal: row.goal,
    assignee: row.assignee,
    priority: row.priority,
    status: row.status,
    plan: row.plan,
    result: row.result,
    budget: row.budget ?? { monthlyLimit: 1000000, dailyLimit: 100000, perRequestLimit: 10000, costLimit: 10.0 },
    approvalGates: row.approval_gates ?? [],
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

agentRouter.get('/tasks', async (c) => {
  const projectId = c.req.query('project_id');

  if (db.connected) {
    const rows = projectId
      ? await db.query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC', [projectId])
      : await db.query('SELECT * FROM tasks ORDER BY created_at DESC');
    return c.json({ tasks: (rows ?? []).map(toTask) });
  }

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

  if (db.connected) {
    const row = await db.queryOne(
      `INSERT INTO tasks (id, project_id, goal, assignee, priority, status, budget, approval_gates, created_at)
       VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, now())
       RETURNING *`,
      [task.id, task.projectId, task.goal, task.assignee, task.priority,
       JSON.stringify(task.budget), JSON.stringify(task.approvalGates)],
    );
    if (row) {
      const submitted = await agentRuntime.submitTask(task);
      await db.query(
        `UPDATE tasks SET status = $1, plan = $2, result = $3 WHERE id = $4`,
        [submitted.status, submitted.plan ? JSON.stringify(submitted.plan) : null,
         submitted.result ? JSON.stringify(submitted.result) : null, task.id],
      );
      tasks.set(task.id, submitted);
      return c.json(submitted, 201);
    }
  }

  tasks.set(task.id, task);
  const submitted = await agentRuntime.submitTask(task);
  tasks.set(task.id, submitted);
  return c.json(submitted, 201);
});

agentRouter.get('/tasks/:id', async (c) => {
  if (db.connected) {
    const row = await db.queryOne('SELECT * FROM tasks WHERE id = $1', [c.req.param('id')]);
    if (row) return c.json(toTask(row));
  }

  const task = tasks.get(c.req.param('id'));
  if (!task) return c.json({ error: 'Task not found' }, 404);
  return c.json(task);
});

agentRouter.post('/tasks/:id/cancel', async (c) => {
  if (db.connected) {
    const row = await db.queryOne(
      `UPDATE tasks SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [c.req.param('id')],
    );
    if (row) return c.json(toTask(row));
    return c.json({ error: 'Task not found' }, 404);
  }

  const task = tasks.get(c.req.param('id'));
  if (!task) return c.json({ error: 'Task not found' }, 404);
  task.status = 'cancelled';
  tasks.set(task.id, task);
  return c.json(task);
});

agentRouter.post('/tasks/:id/plan', async (c) => {
  const id = c.req.param('id');

  let task: Task | undefined;
  if (db.connected) {
    const row = await db.queryOne('SELECT * FROM tasks WHERE id = $1', [id]);
    if (row) task = toTask(row);
  } else {
    task = tasks.get(id);
  }

  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.plan) return c.json({ error: 'Task already has a plan' }, 409);

  const plan = await agentRuntime.createPlan(task);
  task.plan = plan;

  if (db.connected) {
    await db.query(
      `UPDATE tasks SET plan = $1, status = 'planning' WHERE id = $2`,
      [JSON.stringify(plan), id],
    );
    tasks.set(id, task);
    return c.json(plan);
  }

  tasks.set(task.id, task);
  return c.json(plan);
});

agentRouter.post('/tasks/:id/approve/:gateId', zValidator('json', approveGateSchema), async (c) => {
  const id = c.req.param('id');

  let task: Task | undefined;
  if (db.connected) {
    const row = await db.queryOne('SELECT * FROM tasks WHERE id = $1', [id]);
    if (row) task = toTask(row);
  } else {
    task = tasks.get(id);
  }

  if (!task) return c.json({ error: 'Task not found' }, 404);

  const data = c.req.valid('json');
  const updated = await agentRuntime.approveGate(task, c.req.param('gateId'), data.approved, data.userId, data.notes);

  if (db.connected) {
    await db.query(
      `UPDATE tasks SET approval_gates = $1, status = $2 WHERE id = $3`,
      [JSON.stringify(updated.approvalGates), updated.status, id],
    );
    tasks.set(id, updated);
    return c.json(updated);
  }

  tasks.set(task.id, updated);
  return c.json(updated);
});

agentRouter.get('/agents', (c) => {
  return c.json({ agents: agentRuntime.getAgents() });
});

agentRouter.get('/tools', (c) => {
  return c.json({ tools: agentRuntime.getTools() });
});
