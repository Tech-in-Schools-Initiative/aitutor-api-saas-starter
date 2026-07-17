import { test, expect } from '@playwright/test';

const hasRealAiTutorCredentials =
  !!process.env.AITUTOR_API_KEY &&
  !process.env.AITUTOR_API_KEY.startsWith('ci-dummy') &&
  !!process.env.WORKFLOW_ID &&
  !process.env.WORKFLOW_ID.startsWith('ci-dummy') &&
  !!process.env.NEXT_PUBLIC_AITUTOR_TOKEN &&
  !process.env.NEXT_PUBLIC_AITUTOR_TOKEN.startsWith('ci-dummy');

test.describe('chatbot streaming', () => {
  test.skip(
    !hasRealAiTutorCredentials,
    'Requires real AITUTOR_API_KEY/WORKFLOW_ID/NEXT_PUBLIC_AITUTOR_TOKEN credentials against the external aitutor-api.vercel.app service -- not available in CI or a fresh .env.'
  );

  test('sending a message renders a streamed assistant reply', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('test@test.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard');

    // The chatbot page (/dashboard/chatbot) is a static iframe embedding an
    // external widget; the actual in-app streaming chat (StreamingChat,
    // backed by app/api/chat/route.ts) lives at /dashboard/streaming.
    await page.goto('/dashboard/streaming');
    await page.getByPlaceholder('Type your message...').fill('hello');
    await page.getByRole('button', { name: /send/i }).click();

    await expect(page.locator('[data-role="assistant"]').last()).toContainText(/.+/, { timeout: 15000 });
  });
});
