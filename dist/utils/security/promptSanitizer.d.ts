/**
 * Prompt Sanitization Utilities
 *
 * SECURITY: Detect and mitigate prompt injection attacks
 */
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
export declare function sanitizePrompt(prompt: string, options?: SanitizationOptions): SanitizationResult;
/**
 * Validate that a prompt is not empty
 *
 * @param prompt - The prompt to validate
 * @throws Error if prompt is empty or whitespace-only
 */
export declare function validatePromptNotEmpty(prompt: string): void;
//# sourceMappingURL=promptSanitizer.d.ts.map