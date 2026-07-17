import { test, expect } from '@playwright/test';

test.describe('dashboard/team route', () => {
  test('redirects to the canonical /dashboard route instead of duplicating it', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('test@test.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    await page.goto('/dashboard/team');
    await expect(page).toHaveURL(/\/dashboard\/?$/, { timeout: 15000 });
  });
});
