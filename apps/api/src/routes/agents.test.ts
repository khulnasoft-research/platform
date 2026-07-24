import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { agentRouter } from './agents.js';

const app = new Hono().route('/agents', agentRouter);

const projectId = '00000000-0000-0000-0000-000000000001';

describe('Agent Tasks', () => {
  let taskId: string;

  it('creates a task and auto-plans it', async () => {
    const res = await app.request('/agents/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        goal: 'Build user authentication',
        priority: 'high',
        assignee: 'backend',
      }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.goal).toBe('Build user authentication');
    expect(body.priority).toBe('high');
    expect(body.assignee).toBe('backend');
    expect(body.plan).toBeDefined();
    expect(body.plan.steps.length).toBeGreaterThan(0);
    expect(body.result).toBeDefined();
    expect(body.status).toBe('completed');
    taskId = body.id;
  });

  it('creates a task with approval gates', async () => {
    const res = await app.request('/agents/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        goal: 'Delete production database',
        priority: 'critical',
        assignee: 'planner',
        approvalGates: ['destructive', 'security'],
      }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.approvalGates).toHaveLength(2);
    expect(body.approvalGates[0]!.type).toBe('destructive');
    expect(body.approvalGates[0]!.status).toBe('pending');
    expect(body.status).toBe('waiting');
    expect(body.plan).toBeDefined();
    expect(body.result).toBeNull();
  });

  it('lists tasks by project', async () => {
    const res = await app.request(`/agents/tasks?project_id=${projectId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tasks.length).toBeGreaterThanOrEqual(2);
  });

  it('gets a task by id', async () => {
    const res = await app.request(`/agents/tasks/${taskId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(taskId);
  });

  it('cancels a task', async () => {
    const res = await app.request('/agents/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        goal: 'Temporary task',
        priority: 'low',
      }),
    });
    const task = await res.json();

    const cancelRes = await app.request(`/agents/tasks/${task.id}/cancel`, {
      method: 'POST',
    });
    expect(cancelRes.status).toBe(200);

    const cancelled = await cancelRes.json();
    expect(cancelled.status).toBe('cancelled');
  });

  it('returns 404 for unknown task', async () => {
    const res = await app.request(
      '/agents/tasks/00000000-0000-0000-0000-000000009999',
    );
    expect(res.status).toBe(404);
  });
});

describe('Agent Runtime introspection', () => {
  it('lists available agents', async () => {
    const res = await app.request('/agents/agents');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.agents.length).toBeGreaterThan(0);
    expect(body.agents[0]!.type).toBe('architect');
    expect(body.agents[0]!.tools).toBeDefined();
  });

  it('lists available tools', async () => {
    const res = await app.request('/agents/tools');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tools.length).toBeGreaterThan(0);
    expect(body.tools[0]!.name).toBe('read-files');
    expect(body.tools[0]!.description).toBeDefined();
  });
});

describe('Task planning', () => {
  let taskId: string;

  it('explicitly creates a plan for a task', async () => {
    const res = await app.request('/agents/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        goal: 'Add user profile page',
        priority: 'medium',
        assignee: 'frontend',
      }),
    });
    const task = await res.json();
    taskId = task.id;

    const planRes = await app.request(`/agents/tasks/${taskId}/plan`, {
      method: 'POST',
    });
    expect(planRes.status).toBe(409);
  });

  it('approves a gate and executes task', async () => {
    const res = await app.request('/agents/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        goal: 'Deploy to production',
        priority: 'critical',
        assignee: 'architect',
        approvalGates: ['deployment'],
      }),
    });
    const task = await res.json();

    const gateId = task.approvalGates[0]!.id;

    const approveRes = await app.request(
      `/agents/tasks/${task.id}/approve/${gateId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: true,
          userId: 'user-1',
          notes: 'Approved for production',
        }),
      },
    );
    expect(approveRes.status).toBe(200);

    const approved = await approveRes.json();
    expect(approved.status).toBe('completed');
    expect(approved.result).toBeDefined();
  });
});
