// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription } from '@repo/ui/components/card';

describe('Card heading semantics', () => {
  it('renders CardTitle as an <h3> so dashboard cards keep a real heading in the accessibility tree', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Team Settings</CardTitle>
        </CardHeader>
      </Card>
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Team Settings' })).toBeTruthy();
  });

  it('renders CardDescription as a <p>', () => {
    render(<CardDescription>Some description</CardDescription>);
    const el = screen.getByText('Some description');
    expect(el.tagName).toBe('P');
  });
});
