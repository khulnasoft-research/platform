import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { previewRouter } from '../routes/previews.js';
import { db } from '../db/index.js';

const app = new Hono().route('/', previewRouter);

function itIfDb(description: string, fn: () => Promise<void>) {
  if (db.connected) it(description, fn);
}

beforeAll(async () => {
  if (db.connected) {
    await db.query("DELETE FROM preview_sessions WHERE framework = 'int-test'");
  }
});

describe('Previews Integration', () => {
  itIfDb('creates session and persists to DB', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '00000000-0000-0000-0000-000000000001',
        taskId: '00000000-0000-0000-0000-000000000002',
        framework: 'int-test',
      }),
    });
    expect(res.status).toBe(201);
    const session = await res.json();

    const row = await db.queryOne('SELECT * FROM preview_sessions WHERE id = $1', [session.id]);
    expect(row).not.toBeNull();
    expect(row?.framework).toBe('int-test');
  });

  itIfDb('lists sessions from DB', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.previews)).toBe(true);
    const match = body.previews.find((s: { framework: string }) => s.framework === 'int-test');
    expect(match).toBeDefined();
  });

  itIfDb('gets session by ID from DB', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '00000000-0000-0000-0000-000000000001',
        taskId: '00000000-0000-0000-0000-000000000002',
        framework: 'int-test',
      }),
    });
    const session = await createRes.json();

    const res = await app.request(`/${session.id}`);
    expect(res.status).toBe(200);
    expect((await res.json()).framework).toBe('int-test');
  });

  itIfDb('stops session and updates DB', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '00000000-0000-0000-0000-000000000001',
        taskId: '00000000-0000-0000-0000-000000000002',
        framework: 'int-test',
      }),
    });
    const session = await createRes.json();

    const res = await app.request(`/${session.id}/stop`, { method: 'POST' });
    expect(res.status).toBe(200);

    const row = await db.queryOne('SELECT status FROM preview_sessions WHERE id = $1', [session.id]);
    expect(row).not.toBeNull();
    expect(['stopped', 'error', 'ready'].includes(row?.status)).toBe(true);
  });
});
