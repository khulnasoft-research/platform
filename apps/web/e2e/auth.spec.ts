import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('login page has form fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /register/i })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('bad@example.com');
    await page.getByLabel(/password/i).fill('wrong');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/login failed/i)).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.getByLabel(/email/i).fill('e2e@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test('register link navigates to register page', async ({ page }) => {
    await page.getByRole('link', { name: /register/i }).click();
    await page.waitForURL(/\/register/);
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  });
});

test.describe('Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('register page has form fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('successful registration redirects to dashboard', async ({ page }) => {
    const uniqueEmail = `e2e-${Date.now()}@test.com`;
    await page.getByLabel(/name/i).fill('E2E User');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /create account/i }).click();

    await page.waitForURL(/\/dashboard/);
  });

  test('shows error on duplicate email', async ({ page }) => {
    await page.getByLabel(/name/i).fill('E2E User');
    await page.getByLabel(/email/i).fill('existing@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/email already registered/i)).toBeVisible();
  });
});
