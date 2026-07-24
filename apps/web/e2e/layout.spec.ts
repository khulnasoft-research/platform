import { test, expect } from '@playwright/test';
import { devices } from '@playwright/test';

test.describe('Responsive Layout', () => {
  test('landing page is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();
  });

  test('login form is usable on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('e2e@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test('dashboard is functional on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('e2e@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);

    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new project/i })).toBeVisible();
  });
});
