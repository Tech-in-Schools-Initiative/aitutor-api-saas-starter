// apps/web/tests/unit/testimonial-cards.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShuffleCards } from '@/components/landing-page/timeline/components/testimonial-cards';

describe('ShuffleCards testimonials', () => {
  it('does not contain the mangled "next flix" phrasing', () => {
    render(<ShuffleCards />);
    expect(screen.queryByText(/next flix/i)).toBeNull();
  });

  it('joins the first testimonial into one grammatical sentence instead of starting a sentence with "And"', () => {
    render(<ShuffleCards />);
    // The component wraps `testimonial` in literal quote characters
    // (`"{testimonial}"`), which React renders as separate sibling text
    // nodes. getByText's default exact-string matcher only concatenates an
    // element's *direct* child text nodes (including those literal quotes),
    // so matching the bare sentence (no surrounding quotes) as the plan
    // originally specified can never succeed. Matching against the full
    // rendered textContent (quotes included) is the correct equivalent.
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName.toLowerCase() === "span" &&
          element.textContent ===
            "\"It started as a quick pilot yesterday to test @myaitutor's beta API and turned into my own little fridge wiz\""
      )
    ).toBeTruthy();
  });
});
