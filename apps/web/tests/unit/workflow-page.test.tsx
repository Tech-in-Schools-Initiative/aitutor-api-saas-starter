// apps/web/tests/unit/workflow-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Workflow from '@/app/(dashboard)/dashboard/workflow/page';

vi.mock('@/components/workflow/WorkflowHistoryDrawer', () => ({
  WorkflowHistoryDrawer: () => null,
}));

describe('Workflow dashboard page', () => {
  it('renders the shared Card/Input/Button primitives instead of raw elements', () => {
    const { container } = render(<Workflow />);
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="input"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="button"]')).toBeTruthy();
    expect(container.querySelector('.glass-morphism')).toBeNull();
  });

  it('still submits the story prompt to /api/run and renders the result', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'Once upon a time.' }),
    }) as unknown as typeof fetch;

    render(<Workflow />);
    fireEvent.change(screen.getByLabelText('Enter your story prompt'), {
      target: { value: 'a magical forest' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate story/i }));

    await waitFor(() => {
      expect(screen.getByText(/once upon a time/i)).toBeTruthy();
    });
  });

  it('no longer imports the unused next/link module', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'app/(dashboard)/dashboard/workflow/page.tsx'),
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]next\/link['"]/);
  });
});
