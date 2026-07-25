import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { previewRouter } from './previews.js';

const app = new Hono().route('/previews', previewRouter);

const sampleFiles = [
  {
    path: 'src/app/page.tsx',
    content: 'export default function Home() { return <h1>Hello</h1>; }',
    type: 'source' as const,
    size: 64,
    updatedAt: new Date().toISOString(),
  },
  {
    path: 'package.json',
    content: JSON.stringify({ name: 'test-app', dependencies: { next: '15' } }),
    type: 'config' as const,
    size: 128,
    updatedAt: new Date().toISOString(),
  },
];

describe('Preview Sessions CRUD', () => {
  let sessionId: string;

  it('creates a preview session', async () => {
    const res = await app.request('/previews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '00000000-0000-0000-0000-000000000001',
        taskId: '00000000-0000-0000-0000-000000000002',
        framework: 'nextjs',
        files: sampleFiles,
      }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.projectId).toBe('00000000-0000-0000-0000-000000000001');
    expect(body.framework).toBe('nextjs');
    expect(body.status).toBe('building');
    expect(body.url).toContain('.preview.ai-platform.dev');
    expect(body.buildLogs.length).toBeGreaterThan(0);
    sessionId = body.id;
  });

  it('lists preview sessions', async () => {
    const res = await app.request(
      '/previews?project_id=00000000-0000-0000-0000-000000000001',
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.previews.length).toBe(1);
    expect(body.previews[0]?.id).toBe(sessionId);
  });

  it('gets a session by id', async () => {
    const res = await app.request(`/previews/${sessionId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(sessionId);
    expect(body.files).toHaveLength(2);
  });

  it('returns 404 for unknown session', async () => {
    const res = await app.request(
      '/previews/00000000-0000-0000-0000-000000009999',
    );
    expect(res.status).toBe(404);
  });
});

describe('Preview Session lifecycle', () => {
  let sessionId: string;

  beforeAll(async () => {
    const res = await app.request('/previews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '00000000-0000-0000-0000-000000000001',
        taskId: '00000000-0000-0000-0000-000000000002',
        framework: 'vite',
        files: [],
      }),
    });
    const body = await res.json();
    sessionId = body.id;
  });

  it('builds and transitions to running', async () => {
    await new Promise((r) => setTimeout(r, 4000));

    const res = await app.request(`/previews/${sessionId}`);
    const body = await res.json();
    expect(body.status).toBe('running');
    expect(body.buildLogs.length).toBeGreaterThan(3);
  });

  it('streams build logs via SSE', async () => {
    const res = await app.request(`/previews/${sessionId}/logs/stream`);
    const text = await res.text();
    expect(text).toContain('event: log');
    expect(text).toContain('event: status');
    expect(text).toContain('"status":"running"');
  });

  it('returns build logs', async () => {
    const res = await app.request(`/previews/${sessionId}/logs`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.logs.length).toBeGreaterThan(0);
    expect(body.logs[0]?.message).toBeDefined();
    expect(body.logs[0]?.level).toBeDefined();
  });

  it('filters logs by since timestamp', async () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    const res = await app.request(`/previews/${sessionId}/logs?since=${future}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.logs).toHaveLength(0);
  });

  it('stops a running session', async () => {
    const res = await app.request(`/previews/${sessionId}/stop`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('stopped');
    expect(body.stoppedAt).toBeDefined();
  });
});

describe('Preview file management', () => {
  let sessionId: string;

  beforeAll(async () => {
    const res = await app.request('/previews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '00000000-0000-0000-0000-000000000001',
        taskId: '00000000-0000-0000-0000-000000000002',
        framework: 'nextjs',
        files: sampleFiles,
      }),
    });
    const body = await res.json();
    sessionId = body.id;
  });

  it('updates files and adds new ones', async () => {
    await new Promise((r) => setTimeout(r, 4000));

    const res = await app.request(`/previews/${sessionId}/files`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [
          {
            path: 'src/app/page.tsx',
            content: 'export default function Home() { return <h1>Updated</h1>; }',
            type: 'source',
            size: 72,
            updatedAt: new Date().toISOString(),
          },
          {
            path: 'src/app/layout.tsx',
            content: 'export default function Layout({ children }) { return <>{children}</>; }',
            type: 'source',
            size: 90,
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.files).toHaveLength(3);
    const pageFile = body.files.find((f: { path: string; content: string }) => f.path === 'src/app/page.tsx');
    expect(pageFile).toBeDefined();
    expect(pageFile.content).toContain('Updated');
  });

  it('returns metrics', async () => {
    const res = await app.request(`/previews/${sessionId}/metrics`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sessionId).toBe(sessionId);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.memoryUsageMb).toBeGreaterThan(0);
  });
});
