import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@react-email/render';
import { EmailLayout } from '../../src/templates/EmailLayout';

describe('EmailLayout', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, BASE_URL: 'https://example.com' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('renders the logo at an absolute URL derived from BASE_URL', async () => {
    const html = await render(
      <EmailLayout previewText="Preview text">
        <p>Body content</p>
      </EmailLayout>,
    );
    expect(html).toContain('src="https://example.com/logo-long.png"');
  });

  it('renders the preview text and children', async () => {
    const html = await render(
      <EmailLayout previewText="Reset your password">
        <p>Unique body marker</p>
      </EmailLayout>,
    );
    expect(html).toContain('Reset your password');
    expect(html).toContain('Unique body marker');
  });

  it('matches the known-good markup snapshot', async () => {
    const html = await render(
      <EmailLayout previewText="Preview text">
        <p>Body content</p>
      </EmailLayout>,
    );
    expect(html).toMatchSnapshot();
  });
});
