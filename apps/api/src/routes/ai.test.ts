import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { aiRouter } from './ai.js';

const app = new Hono().route('/ai', aiRouter);

describe('POST /ai/chat (streaming)', () => {
  it('returns SSE events', async () => {
    const res = await app.request('/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const text = await res.text();
    expect(text).toContain('event: meta');
    expect(text).toContain('event: token');
    expect(text).toContain('event: finish');
  });
});

describe('POST /ai/chat (non-streaming)', () => {
  it('returns JSON response', async () => {
    const res = await app.request('/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');

    const body = await res.json();
    expect(body.requestId).toBeDefined();
    expect(body.content).toBeDefined();
  });
});

describe('POST /ai/generate', () => {
  it('returns code generation SSE events', async () => {
    const res = await app.request('/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Generate an API' }],
        projectId: '00000000-0000-0000-0000-000000000001',
        stream: true,
      }),
    });
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain('event: meta');
    expect(text).toContain('event: diff');
    expect(text).toContain('event: finish');
  });
});

describe('GET /ai/models', () => {
  it('returns available models', async () => {
    const res = await app.request('/ai/models');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.models.length).toBeGreaterThan(0);
    expect(body.models[0]!.id).toBe('claude-sonnet-4');
  });
});
