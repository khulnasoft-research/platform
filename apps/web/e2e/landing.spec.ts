import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('has correct title and CTA buttons', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/AI Engineering Platform/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      /AI Engineering Platform/,
    );

    const signInLink = page.getByRole('link', { name: /sign in/i });
    const registerLink = page.getByRole('link', { name: /register/i });

    await expect(signInLink).toBeVisible();
    await expect(registerLink).toBeVisible();
    await expect(signInLink).toHaveAttribute('href', '/login');
    await expect(registerLink).toHaveAttribute('href', '/register');
  });

  test('redirects to dashboard if already logged in', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('session_token', 'test-token');
    });
    await page.goto('/');
    await page.waitForURL(/\/dashboard/);
  });
});
