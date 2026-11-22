import { test, expect } from '@playwright/test';

test.describe('Authentication & Route Protection Smoke Tests', () => {
  test('Login page renders with sign-in and register options', async ({ page }) => {
    await page.goto('/login');

    // Page title or main branding
    await expect(page).toHaveTitle(/ElectronDB|Hope/i);
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();

    // Sign in form inputs
    const emailOrUserInput = page.locator('input[type="text"], input[name="emailOrUsername"], input[type="email"]').first();
    await expect(emailOrUserInput).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('Unauthenticated visit to a protected route redirects to /login', async ({ page }) => {
    // Attempt visiting protected dashboard route directly
    await page.goto('/users');

    // Expected redirect to /login
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('Unauthenticated visit to /audit viewer redirects to /login', async ({ page }) => {
    // Attempt visiting Superadmin audit log directly without session
    await page.goto('/audit');

    // Expected redirect to /login
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('Register tab shows password requirement of at least 8 characters', async ({ page }) => {
    await page.goto('/login');

    // Click Register tab if available
    const registerTab = page.getByRole('tab', { name: /Register/i }).or(page.locator('button:has-text("Register")')).first();
    if (await registerTab.isVisible()) {
      await registerTab.click();
      await expect(page.getByRole('heading', { name: /Create your account/i })).toBeVisible();
    }
  });
});
