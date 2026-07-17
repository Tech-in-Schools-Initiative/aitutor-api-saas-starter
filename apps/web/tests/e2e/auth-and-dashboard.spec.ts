import { test, expect } from '@playwright/test';

test.describe('auth and dashboard', () => {
  test('sign-up redirects to the dashboard', async ({ page }) => {
    const uniqueEmail = `e2e-${Date.now()}@example.com`;
    await page.goto('/sign-up');
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password').fill('e2e-test-password');
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('sign-in with the seeded user lands on the dashboard', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('test@test.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('dashboard loads with no console errors and renders the sidebar', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('test@test.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    await expect(page.getByRole('link', { name: /workflow/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /team/i })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
