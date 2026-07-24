import { test, expect } from '@playwright/test';

const testProject = `E2E Project ${Date.now()}`;

test.describe('Project CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('e2e@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('creates a new project', async ({ page }) => {
    await page.getByRole('button', { name: /new project/i }).click();
    await page.getByLabel(/name/i).fill(testProject);
    await page.getByLabel(/description/i).fill('Project created by E2E test');
    await page.getByRole('button', { name: /create project/i }).click();

    await expect(page.getByText(testProject)).toBeVisible();
  });

  test('view project details', async ({ page }) => {
    const card = page.getByText(testProject).first();
    await card.click();

    await expect(page.getByRole('heading', { name: testProject })).toBeVisible();
    await expect(page.getByText('Project created by E2E test')).toBeVisible();
    await expect(page.getByRole('button', { name: /ai settings/i })).toBeVisible();
  });

  test('deletes a project', async ({ page }) => {
    const card = page.getByText(testProject).first();
    await card.click();

    await page.getByRole('button', { name: /delete/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(testProject)).not.toBeVisible();
  });
});
