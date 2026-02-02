/**
 * Prompt Sanitization Utilities
 *
 * SECURITY: Detect and mitigate prompt injection attacks
 */

import { logger } from "../logger.js";

// Maximum prompt length (50k characters)
const MAX_PROMPT_LENGTH = 50000;

// SECURITY: Highly dangerous patterns that should be BLOCKED entirely
// These patterns indicate clear prompt injection attempts
const BLOCKING_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /forget\s+(everything|all|your\s+(rules|instructions))/gi,
  /disregard\s+(all\s+)?(previous|prior)\s+(instructions|rules|context)/gi,
  /system\s*:\s*role\s*=/gi,
  /\[SYSTEM\]/gi,
  /\{role:\s*"system"\}/gi,
];

// SECURITY: Suspicious patterns that warrant redaction and logging
// These are replaced with [REDACTED] but don't block execution
const REDACT_PATTERNS = [
  { pattern: /\brm\s+-rf\s+[\/\w]+/gi, replacement: '[REDACTED_DANGEROUS_COMMAND]' },
  { pattern: /\bsudo\s+\w+/gi, replacement: '[REDACTED_SUDO]' },
  { pattern: /\bexec\s*\(/gi, replacement: '[REDACTED_EXEC]' },
  { pattern: /\beval\s*\(/gi, replacement: '[REDACTED_EVAL]' },
  { pattern: /import\s+os\s*;/gi, replacement: '[REDACTED_OS_IMPORT]' },
  { pattern: /os\.system\s*\(/gi, replacement: '[REDACTED_OS_SYSTEM]' },
  { pattern: /__import__\s*\(/gi, replacement: '[REDACTED_IMPORT]' },
];

// WARNING: Patterns to monitor but not modify
const WARNING_PATTERNS = [
  /you\s+are\s+now\s+a/gi,
  /act\s+as\s+(if\s+)?you\s+(are|were)/gi,
  /pretend\s+(to\s+be|you\s+are)/gi,
];

export interface SanitizationResult {
  sanitized: string;
  warnings: string[];
  blocked: boolean;
  truncated: boolean;
}

export interface SanitizationOptions {
  /** Skip blocking patterns (for trusted/internal workflows) */
  skipBlocking?: boolean;
  /** Skip redaction (for trusted/internal workflows) */
  skipRedaction?: boolean;
}

/**
 * SECURITY: Sanitize prompt to detect and mitigate injection attempts
 *
 * Multi-layer defense:
 * 1. Length validation and truncation
 * 2. BLOCKING: Reject prompts with clear injection patterns (unless skipBlocking=true)
 * 3. REDACTION: Replace dangerous code patterns with [REDACTED] (unless skipRedaction=true)
 * 4. WARNING: Log suspicious patterns for monitoring
 * 5. Audit trail for all security events
 *
 * @param prompt - The prompt to sanitize
 * @param options - Sanitization options (skipBlocking for internal workflows)
 * @returns Sanitized prompt with security metadata
 * @throws Error if prompt contains blocking patterns (unless skipBlocking=true)
 */
export function sanitizePrompt(
  prompt: string,
  options: SanitizationOptions = {}
): SanitizationResult {
  const { skipBlocking = false, skipRedaction = false } = options;
  const warnings: string[] = [];
  let sanitized = prompt;
  let truncated = false;
  let blocked = false;

  // 1. Length check and truncation
  if (sanitized.length > MAX_PROMPT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_PROMPT_LENGTH);
    truncated = true;
    warnings.push(`Prompt truncated to ${MAX_PROMPT_LENGTH} characters`);
  }

  // 2. BLOCKING: Check for prompt injection attempts (unless skipped)
  if (!skipBlocking) {
    for (const pattern of BLOCKING_PATTERNS) {
      if (pattern.test(sanitized)) {
        blocked = true;
        const error = `Prompt injection attempt blocked: ${pattern.source}`;
        warnings.push(error);

        logger.error("SECURITY: Prompt injection blocked", {
          pattern: pattern.source,
          promptPreview: sanitized.substring(0, 100),
        });

        throw new Error(`Security: ${error}`);
      }
    }
  }

  // 3. REDACTION: Replace dangerous code patterns (unless skipped)
  if (!skipRedaction) {
    for (const { pattern, replacement } of REDACT_PATTERNS) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, replacement);
        warnings.push(`Redacted dangerous pattern: ${pattern.source}`);

        logger.warn("SECURITY: Dangerous pattern redacted", {
          pattern: pattern.source,
          replacement,
        });
      }
    }
  }

  // 4. WARNING: Monitor suspicious patterns (non-blocking)
  for (const pattern of WARNING_PATTERNS) {
    if (pattern.test(sanitized)) {
      warnings.push(`Suspicious pattern detected: ${pattern.source}`);
    }
  }

  // 5. Audit logging for security monitoring
  if (warnings.length > 0) {
    logger.warn("Prompt sanitization applied", {
      warnings,
      promptLength: prompt.length,
      truncated,
      blocked,
    });
  }

  return { sanitized, warnings, blocked, truncated };
}

/**
 * Validate that a prompt is not empty
 *
 * @param prompt - The prompt to validate
 * @throws Error if prompt is empty or whitespace-only
 */
export function validatePromptNotEmpty(prompt: string): void {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt cannot be empty");
  }
}
