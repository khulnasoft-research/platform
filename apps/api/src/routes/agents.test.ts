import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { agentRouter } from './agents.js';

const app = new Hono().route('/agents', agentRouter);

describe('Agent Tasks', () => {
  let taskId: string;
  const projectId = '00000000-0000-0000-0000-000000000001';

  it('creates a task', async () => {
    const res = await app.request('/agents/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        goal: 'Build user authentication',
        priority: 'high',
      }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.goal).toBe('Build user authentication');
    expect(body.priority).toBe('high');
    expect(body.status).toBe('queued');
    expect(body.budget).toBeDefined();
    taskId = body.id;
  });

  it('lists tasks by project', async () => {
    const res = await app.request(`/agents/tasks?project_id=${projectId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0]!.id).toBe(taskId);
  });

  it('gets a task by id', async () => {
    const res = await app.request(`/agents/tasks/${taskId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(taskId);
  });

  it('cancels a task', async () => {
    const res = await app.request(`/agents/tasks/${taskId}/cancel`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('cancelled');
  });

  it('returns 404 for unknown task', async () => {
    const res = await app.request(
      '/agents/tasks/00000000-0000-0000-0000-000000009999',
    );
    expect(res.status).toBe(404);
  });
});
