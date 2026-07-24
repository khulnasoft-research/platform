import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { agentRouter } from '../routes/agents.js';
import { db } from '../db/index.js';

const app = new Hono().route('/', agentRouter);
const projectId = '00000000-0000-0000-0000-000000000001';

function itIfDb(description: string, fn: () => Promise<void>) {
  if (db.connected) it(description, fn);
}

beforeAll(async () => {
  if (db.connected) {
    await db.query("DELETE FROM tasks WHERE goal LIKE 'int-test-%'");
  }
});

describe('Agents Integration', () => {
  itIfDb('creates task and persists to DB', async () => {
    const res = await app.request('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        goal: 'int-test-create-task',
        assignee: 'planner',
        priority: 'high',
      }),
    });
    expect(res.status).toBe(201);
    const task = await res.json();

    const row = await db.queryOne('SELECT * FROM tasks WHERE id = $1', [task.id]);
    expect(row).not.toBeNull();
    expect(row!.goal).toBe('int-test-create-task');
    expect(row!.assignee).toBe('planner');
  });

  itIfDb('lists tasks from DB', async () => {
    await app.request('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, goal: 'int-test-list-task', assignee: 'architect' }),
    });

    const res = await app.request('/tasks');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.tasks)).toBe(true);
    const match = body.tasks.find((t: any) => t.goal === 'int-test-list-task');
    expect(match).toBeDefined();
  });

  itIfDb('cancels task in DB', async () => {
    const createRes = await app.request('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, goal: 'int-test-cancel-task', assignee: 'planner' }),
    });
    const task = await createRes.json();

    const res = await app.request(`/tasks/${task.id}/cancel`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('cancelled');

    const row = await db.queryOne('SELECT status FROM tasks WHERE id = $1', [task.id]);
    expect(row!.status).toBe('cancelled');
  });

  itIfDb('generates plan and persists to DB', async () => {
    const createRes = await app.request('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, goal: 'int-test-plan-task', assignee: 'planner' }),
    });
    const task = await createRes.json();

    const res = await app.request(`/tasks/${task.id}/plan`, { method: 'POST' });
    expect(res.status).toBe(200);
    const plan = await res.json();
    expect(plan.steps).toBeDefined();

    const row = await db.queryOne('SELECT plan FROM tasks WHERE id = $1', [task.id]);
    expect(row!.plan).not.toBeNull();
  });

  itIfDb('finds task by ID from DB', async () => {
    const createRes = await app.request('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, goal: 'int-test-get-task', assignee: 'planner' }),
    });
    const task = await createRes.json();

    const res = await app.request(`/tasks/${task.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goal).toBe('int-test-get-task');
  });
});
