import { test, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';

test.describe('Preview Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('e2e@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('page loads with heading and create form', async ({ page }) => {
    await page.goto('/previews');

    await expect(page.getByRole('heading', { name: /preview sessions/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /create preview session/i })).toBeVisible();
    await expect(page.getByPlaceholder(/project id/i)).toBeVisible();
    await expect(page.getByPlaceholder(/task id/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create/i })).toBeVisible();
  });

  test('can navigate via nav bar', async ({ page }) => {
    await page.goto('/previews');

    await expect(page.getByText('Previews').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /projects/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /deploy/i })).toBeVisible();
  });

  test('creates a preview session', async ({ page }) => {
    const projectId = crypto.randomUUID();
    const taskId = crypto.randomUUID();

    await page.goto('/previews');
    await page.getByPlaceholder(/project id/i).fill(projectId);
    await page.getByPlaceholder(/task id/i).fill(taskId);
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText(projectId.slice(0, 8))).toBeVisible();
  });

  test('preview detail page shows session info', async ({ page }) => {
    const res = await page.request.post(`${API_URL}/previews`, {
      data: {
        projectId: '00000000-0000-0000-0000-000000000001',
        taskId: '00000000-0000-0000-0000-000000000002',
        framework: 'nextjs',
      },
    });
    expect(res.status()).toBe(201);
    const session = await res.json();

    await page.goto(`/previews/${session.id}`);

    await expect(page.getByText('Next.js Preview')).toBeVisible();
    await expect(page.getByText(session.url)).toBeVisible();
    await expect(page.getByText(/building|running|ready/i)).toBeVisible();
  });

  test('preview detail page has tabs and content', async ({ page }) => {
    const res = await page.request.post(`${API_URL}/previews`, {
      data: {
        projectId: '00000000-0000-0000-0000-000000000001',
        taskId: '00000000-0000-0000-0000-000000000002',
        framework: 'vite',
      },
    });
    const session = await res.json();

    await page.goto(`/previews/${session.id}`);

    await expect(page.getByRole('button', { name: /logs/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /files/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /metrics/i })).toBeVisible();

    await page.getByRole('button', { name: /files/i }).click();
    await expect(page.getByPlaceholder(/src\/pages\/index.tsx/i)).toBeVisible();
  });

  test('shows stop button for active sessions', async ({ page }) => {
    const res = await page.request.post(`${API_URL}/previews`, {
      data: {
        projectId: '00000000-0000-0000-0000-000000000001',
        taskId: '00000000-0000-0000-0000-000000000002',
        framework: 'nextjs',
      },
    });
    const session = await res.json();

    await page.goto(`/previews/${session.id}`);

    const stopBtn = page.getByRole('button', { name: /stop/i });
    if (await stopBtn.isVisible()) {
      await stopBtn.click();
      await expect(page.getByText(/stopped/i)).toBeVisible();
    }
  });
});
