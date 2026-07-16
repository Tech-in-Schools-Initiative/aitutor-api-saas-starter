import { describe, it, expect } from 'vitest';
import { marked } from 'marked';

// StoryDisplay.tsx (components/ai-tutor-api/StoryDisplay.tsx) depends on this
// exact synchronous Lexer/Parser API. This locks it in across the marked
// 15 -> 18 bump.
describe('marked Lexer/Parser API used by StoryDisplay.tsx', () => {
  it('lexes and parses markdown into the expected HTML', () => {
    const parser = new marked.Parser();
    const lexer = new marked.Lexer();
    const tokens = lexer.lex('# Hello\n\nThis is **bold** and *italic* text.');
    const html = parser.parse(tokens);
    expect(typeof html).toBe('string');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('returns a synchronous string, not a Promise', () => {
    const parser = new marked.Parser();
    const lexer = new marked.Lexer();
    const tokens = lexer.lex('Just plain text.');
    const result = parser.parse(tokens);
    expect(result).not.toBeInstanceOf(Promise);
  });
});
