import { describe, it, expect } from 'vitest';
import { sanitizeUserInput, MAX_INPUT_LENGTH } from '../../../src/utils/security/inputSanitizer.js';

describe('sanitizeUserInput', () => {
  it('returns the input unchanged when within the limit', () => {
    const input = 'short input';
    expect(sanitizeUserInput(input)).toBe(input);
  });

  it('truncates input exceeding MAX_INPUT_LENGTH characters', () => {
    const overlong = 'a'.repeat(MAX_INPUT_LENGTH + 100);
    const result = sanitizeUserInput(overlong);
    expect(result.length).toBe(MAX_INPUT_LENGTH);
  });

  it('truncates at exactly MAX_INPUT_LENGTH boundary', () => {
    const exact = 'x'.repeat(MAX_INPUT_LENGTH);
    expect(sanitizeUserInput(exact)).toBe(exact);
  });

  it('trims leading/trailing whitespace after truncation', () => {
    const padded = '  hello world  ';
    expect(sanitizeUserInput(padded)).toBe('hello world');
  });

  it('truncates then trims (whitespace at boundary does not survive)', () => {
    // Build a string where the character at position MAX_INPUT_LENGTH-1 is a space
    const body = 'a'.repeat(MAX_INPUT_LENGTH - 1) + ' trailing';
    const result = sanitizeUserInput(body);
    // slice(0, MAX_INPUT_LENGTH) = body minus ' trailing', then trim strips trailing space
    expect(result.length).toBe(MAX_INPUT_LENGTH - 1);
    expect(result).toBe('a'.repeat(MAX_INPUT_LENGTH - 1));
  });

  it('handles an empty string', () => {
    expect(sanitizeUserInput('')).toBe('');
  });

  it('MAX_INPUT_LENGTH is 5000', () => {
    expect(MAX_INPUT_LENGTH).toBe(5_000);
  });
});
