import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { healthRouter } from './health.js';

const app = new Hono().route('/', healthRouter);

describe('GET /health', () => {
  it('returns healthy status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.version).toBe('0.1.0');
    expect(body.services).toBeDefined();
    expect(body.services.database).toBe('unconfigured');
    expect(body.services.redis).toBe('unconfigured');
  });
});
