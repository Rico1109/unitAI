/**
 * Centralized configuration for the unitAI MCP Server.
 *
 * Rules:
 *   1. `process.env` is accessed ONLY in this file.
 *   2. All project-specific variables are prefixed with `UNITAI_`.
 *   3. Strings are cast to typed values (boolean, enum) at this layer.
 *   4. Zero-config: the app runs correctly with no environment variables set.
 *
 * SECRETS NOTE: None of the current variables are secrets. If API keys or
 * tokens are added in the future, mark them in SENSITIVE_KEYS below and
 * never log or expose their values.
 */

// ============================================================================
// Types
// ============================================================================

export type EnvMode = "development" | "production" | "test";
export type LogLevelName = "debug" | "info" | "warn" | "error";

// ============================================================================
// Helpers (private — not exported)
// ============================================================================

function parseBoolean(val: string | undefined, defaultValue: boolean): boolean {
  if (val === undefined) return defaultValue;
  const lower = val.toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  if (lower === "false" || lower === "0" || lower === "no") return false;
  return defaultValue;
}

function parseEnum<T extends string>(
  val: string | undefined,
  allowed: readonly T[],
  defaultValue: T
): T {
  if (val === undefined) return defaultValue;
  const lower = val.toLowerCase() as T;
  return allowed.includes(lower) ? lower : defaultValue;
}

/**
 * Resolve environment mode.
 * Priority: UNITAI_ENV → NODE_ENV → "development"
 */
function resolveEnvMode(): EnvMode {
  const modes = ["development", "production", "test"] as const;
  const unitaiEnv = process.env.UNITAI_ENV;
  if (unitaiEnv !== undefined) return parseEnum(unitaiEnv, modes, "development");
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== undefined) return parseEnum(nodeEnv, modes, "development");
  return "development";
}

// ============================================================================
// CONFIG — single exported object, frozen at module load
// ============================================================================

export const CONFIG = Object.freeze({
  /**
   * Runtime mode.
   * Set via UNITAI_ENV (preferred) or NODE_ENV (fallback).
   */
  runtime: Object.freeze({
    env: resolveEnvMode(),
    get isProduction() { return this.env === "production"; },
    get isDevelopment() { return this.env === "development"; },
  }),

  /**
   * Security overrides — all default to false (fail-closed).
   */
  security: Object.freeze({
    /** Allow backends to run in auto-approve mode. Dev only. */
    allowAutoApprove: parseBoolean(process.env.UNITAI_ALLOW_AUTO_APPROVE, false),
    /** Allow droid --skip-permissions-unsafe flag. Dev only. */
    allowPermissionBypass: parseBoolean(process.env.UNITAI_ALLOW_PERMISSION_BYPASS, false),
  }),

  /**
   * Logging behaviour.
   */
  logging: Object.freeze({
    /** Minimum log level: debug | info | warn | error */
    level: parseEnum(
      process.env.UNITAI_LOG_LEVEL,
      ["debug", "info", "warn", "error"] as const,
      "info"
    ) as LogLevelName,
    /**
     * Mirror structured logs to stderr/console.
     * Default: false — avoids polluting stdout in MCP stdio transport.
     */
    toConsole: parseBoolean(process.env.UNITAI_LOG_TO_CONSOLE, false),
    /** Legacy debug flag used by legacyLogger. */
    debug: parseBoolean(process.env.UNITAI_DEBUG, false),
  }),
});

// ============================================================================
// Startup validation
// ============================================================================

/**
 * Warn about non-standard / risky configuration at startup.
 * Call once from src/index.ts before the server starts.
 *
 * SECRETS RULE: Never log secret values. Add future secret keys to
 * SENSITIVE_KEYS and redact them in any diagnostic output.
 */
export function validateConfig(): void {
  const warnings: string[] = [];

  if (CONFIG.security.allowAutoApprove && !CONFIG.runtime.isDevelopment) {
    warnings.push(
      `UNITAI_ALLOW_AUTO_APPROVE=true in "${CONFIG.runtime.env}" — ensure this is intentional`
    );
  }

  if (CONFIG.security.allowPermissionBypass) {
    warnings.push(
      "UNITAI_ALLOW_PERMISSION_BYPASS=true — security checks are disabled"
    );
  }

  if (CONFIG.logging.level === "debug" && CONFIG.runtime.isProduction) {
    warnings.push(
      "UNITAI_LOG_LEVEL=debug in production — may expose sensitive information in logs"
    );
  }

  for (const warning of warnings) {
    // Use console.warn (stderr) so it doesn't interfere with MCP stdout transport
    console.warn(`[unitAI] ⚠️  config warning: ${warning}`);
  }
}
