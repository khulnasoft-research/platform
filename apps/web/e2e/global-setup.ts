import { request } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';

async function globalSetup() {
  const ctx = await request.newContext({ baseURL: API_URL });

  // Seed test users
  const users = [
    { email: 'e2e@test.com', password: 'password123', name: 'E2E User' },
    { email: 'existing@test.com', password: 'password123', name: 'Existing User' },
  ];

  for (const user of users) {
    await ctx.post('/auth/register', {
      data: user,
      headers: { 'x-e2e-test': '1' },
    });
  }

  await ctx.dispose();
}

export default globalSetup;
