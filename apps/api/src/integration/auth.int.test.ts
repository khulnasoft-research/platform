import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { authRouter } from '../routes/auth.js';
import { db } from '../db/index.js';

const app = new Hono().route('/auth', authRouter);

function itIfDb(description: string, fn: () => Promise<void>) {
  if (db.connected) it(description, fn);
}

describe('Auth Integration', () => {
  beforeAll(async () => {
    if (db.connected) {
      await db.query("DELETE FROM users WHERE email LIKE 'int-test-%'");
    }
  });

  itIfDb('registers user and persists to DB', async () => {
    const email = `int-test-${Date.now()}@example.com`;
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', name: 'Int Test' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBeDefined();

    const row = await db.queryOne('SELECT * FROM users WHERE email = $1', [email]);
    expect(row).not.toBeNull();
    expect(row?.name).toBe('Int Test');
  });

  itIfDb('rejects duplicate email', async () => {
    const email = `int-test-dup-${Date.now()}@example.com`;
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', name: 'First' }),
    });

    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', name: 'Second' }),
    });
    expect(res.status).toBe(400);
  });

  itIfDb('login verifies password hash', async () => {
    const email = `int-test-login-${Date.now()}@example.com`;
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'correct-password', name: 'Login Test' }),
    });

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong-password' }),
    });
    expect(res.status).toBe(401);

    const res2 = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'correct-password' }),
    });
    expect(res2.status).toBe(200);
    const body = await res2.json();
    expect(body.token).toBeDefined();
  });

  itIfDb('session endpoint returns valid session for DB user', async () => {
    const email = `int-test-session-${Date.now()}@example.com`;
    const regRes = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', name: 'Session Test' }),
    });
    const { token } = await regRes.json();

    const res = await app.request('/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.email).toBe(email);
  });
});
