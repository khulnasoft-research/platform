import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { aiRouter } from './ai.js';

const app = new Hono().route('/ai', aiRouter);

describe('POST /ai/chat (streaming)', () => {
  it('returns SSE events via gateway', async () => {
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
  it('returns gateway-routed response', async () => {
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
    expect(body.provider).toBeDefined();
    expect(body.tier).toBeDefined();
    expect(body.usage).toBeDefined();
  });

  it('caches identical non-streaming requests', async () => {
    const req = {
      method: 'POST' as const,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Cache test' }],
        stream: false,
      }),
    };

    const res1 = await app.request('/ai/chat', req);
    const body1 = await res1.json();

    const res2 = await app.request('/ai/chat', req);
    const body2 = await res2.json();

    expect(body2.cached).toBe(true);
    expect(body2.content).toBe(body1.content);
  });

  it('uses correct model route', async () => {
    const res = await app.request('/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: false,
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.provider).toBe('openai');
    expect(body.tier).toBe('fast');
  });

  it('returns 502 for unknown model', async () => {
    const res = await app.request('/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nonexistent-model',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: false,
      }),
    });
    expect(res.status).toBe(502);
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
  it('returns all registered models', async () => {
    const res = await app.request('/ai/models');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.models.length).toBe(7);
    expect(body.models[0]!.id).toBe('claude-sonnet-4');
  });
});

describe('GET /ai/gateway/providers', () => {
  it('returns provider status', async () => {
    const res = await app.request('/ai/gateway/providers');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.providers.length).toBeGreaterThan(0);
    expect(body.providers[0]!.provider).toBeDefined();
    expect(body.providers[0]!.healthy).toBe(true);
  });
});

describe('GET /ai/gateway/usage', () => {
  it('returns usage stats after requests', async () => {
    const res = await app.request('/ai/gateway/usage');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalRequests).toBeGreaterThan(0);
    expect(body.totalCostUsd).toBeGreaterThan(0);
    expect(body.byProvider).toBeDefined();
    expect(body.byTier).toBeDefined();
  });
});
