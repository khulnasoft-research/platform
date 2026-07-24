import { test, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';

test.describe('Deploy Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('e2e@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('page loads with heading and tabs', async ({ page }) => {
    await page.goto('/deploy');

    await expect(page.getByRole('heading', { name: /deployments/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /environments/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /deployments/i })).toBeVisible();
  });

  test('can navigate via nav bar', async ({ page }) => {
    await page.goto('/deploy');

    await expect(page.getByText('Deploy').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /blueprints/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /previews/i })).toBeVisible();
  });

  test('environments tab has create form', async ({ page }) => {
    await page.goto('/deploy');

    await expect(page.getByRole('button', { name: /environments/i })).toBeVisible();
    await page.getByRole('button', { name: /environments/i }).click();

    await expect(page.getByRole('heading', { name: /new environment/i })).toBeVisible();
    await expect(page.getByText(/name/i)).toBeVisible();
    await expect(page.getByText(/type/i)).toBeVisible();
    await expect(page.getByText(/provider/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create environment/i })).toBeVisible();
  });

  test('creates an environment', async ({ page }) => {
    const envName = `E2E Env ${Date.now()}`;

    await page.goto('/deploy');

    const nameInput = page.getByText('Name').locator('..').locator('input');
    await nameInput.fill(envName);
    await page.getByRole('button', { name: /create environment/i }).click();

    await expect(page.getByText(envName)).toBeVisible();
  });

  test('deployments tab has create form', async ({ page }) => {
    const envRes = await page.request.post(`${API_URL}/deploy/environments`, {
      data: {
        projectId: '00000000-0000-0000-0000-000000000001',
        name: `E2E Env ${Date.now()}`,
        type: 'persistent',
        provider: 'vercel',
      },
    });
    const env = await envRes.json();

    await page.goto('/deploy');
    await page.getByRole('button', { name: /deployments/i }).click();

    await expect(page.getByRole('heading', { name: /new deployment/i })).toBeVisible();
    await expect(page.getByText(/commit sha/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create deployment/i })).toBeVisible();
  });

  test('creates a deployment', async ({ page }) => {
    const envRes = await page.request.post(`${API_URL}/deploy/environments`, {
      data: {
        projectId: '00000000-0000-0000-0000-000000000001',
        name: `E2E Env ${Date.now()}`,
        type: 'persistent',
        provider: 'vercel',
      },
    });
    const env = await envRes.json();

    await page.goto('/deploy');
    await page.getByRole('button', { name: /deployments/i }).click();

    const shaInput = page.getByText('Commit SHA').locator('..').locator('input');
    await shaInput.fill('abc123def456');
    const envSelect = page.getByText('Environment').locator('..').locator('select');
    await envSelect.selectOption(env.id);
    await page.getByRole('button', { name: /create deployment/i }).click();

    await expect(page.getByText('abc123de')).toBeVisible();
  });

  test('deployment detail page shows logs and rollback', async ({ page }) => {
    const depRes = await page.request.post(`${API_URL}/deploy`, {
      data: {
        projectId: '00000000-0000-0000-0000-000000000001',
        environmentId: '00000000-0000-0000-0000-000000000001',
        commitSha: 'abc123def456',
        provider: 'vercel',
      },
    });
    const dep = await depRes.json();

    await page.goto(`/deploy/${dep.id}`);

    await expect(page.getByRole('button', { name: /rollback/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /logs/i }).first()).toBeVisible();
  });

  test('environment detail page shows env vars', async ({ page }) => {
    const envRes = await page.request.post(`${API_URL}/deploy/environments`, {
      data: {
        projectId: '00000000-0000-0000-0000-000000000001',
        name: `E2E Env Detail ${Date.now()}`,
        type: 'persistent',
        provider: 'railway',
      },
    });
    const env = await envRes.json();

    await page.goto(`/deploy/${env.id}`);

    await expect(page.getByText(/environment variables/i)).toBeVisible();
    await expect(page.getByPlaceholder(/key=value/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /add/i })).toBeVisible();
  });

  test('can add and remove env vars', async ({ page }) => {
    const envRes = await page.request.post(`${API_URL}/deploy/environments`, {
      data: {
        projectId: '00000000-0000-0000-0000-000000000001',
        name: `E2E Env Vars ${Date.now()}`,
        type: 'persistent',
        provider: 'railway',
      },
    });
    const env = await envRes.json();

    await page.goto(`/deploy/${env.id}`);

    await page.getByPlaceholder(/key=value/i).fill('DATABASE_URL=postgres://db');
    await page.getByRole('button', { name: /add/i }).click();

    await expect(page.getByText(/database_url=\*\*\*\*/i)).toBeVisible();

    await page.getByRole('button', { name: /remove/i }).click();
    await expect(page.getByText(/database_url=\*\*\*\*/i)).not.toBeVisible();
  });
});
