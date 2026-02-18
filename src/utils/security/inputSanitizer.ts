/**
 * User input sanitization utilities.
 *
 * Provides a lightweight cap on raw user-supplied strings (symptoms,
 * featureDescription, etc.) before they are interpolated into AI prompts.
 * This prevents token-budget blow-out and limits the surface area for
 * prompt-injection via extremely long inputs.
 *
 * For deeper sanitization (injection pattern detection, secret redaction)
 * use `sanitizePrompt` from promptSanitizer.ts instead.
 */

export const MAX_INPUT_LENGTH = 5_000;

/**
 * Truncate and trim a raw user-supplied string to MAX_INPUT_LENGTH characters.
 *
 * @param input - The raw user input to sanitize.
 * @returns The sanitized string, at most MAX_INPUT_LENGTH characters.
 */
export function sanitizeUserInput(input: string): string {
  return input.slice(0, MAX_INPUT_LENGTH).trim();
}
