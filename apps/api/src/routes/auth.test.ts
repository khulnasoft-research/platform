import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authRouter } from './auth.js';

const app = new Hono().route('/auth', authRouter);

describe('POST /auth/register', () => {
  it('registers a new user', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('test@example.com');
    expect(body.user.name).toBe('Test User');
  });

  it('rejects invalid email', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid',
        password: 'password123',
        name: 'Test',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects short password', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'short',
        name: 'Test',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing name', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('returns a session', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'any-password',
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('user@example.com');
  });
});

describe('GET /auth/session', () => {
  it('returns unauthorized without bearer token', async () => {
    const res = await app.request('/auth/session');
    expect(res.status).toBe(401);
  });

  it('returns valid with correct bearer token', async () => {
    const res = await app.request('/auth/session', {
      headers: { Authorization: 'Bearer some-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
  });
});
