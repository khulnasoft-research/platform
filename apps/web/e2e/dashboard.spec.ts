import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('e2e@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('displays project list and create button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new project/i })).toBeVisible();
  });

  test('can logout', async ({ page }) => {
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/login/);

    page.goto('/dashboard');
    await page.waitForURL(/\/login/);
  });
});
