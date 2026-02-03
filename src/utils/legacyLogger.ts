/**
 * Legacy Logger Wrapper - maps old API to structuredLogger
 *
 * This wrapper provides backward compatibility by mapping the old logger API
 * (console-only) to the new structuredLogger (JSON + file-based logging).
 *
 * All logs now go to both console (stderr) AND structured log files.
 */
import { structuredLogger, LogCategory } from '../services/structured-logger.js';
import { LOG_PREFIX } from '../constants.js';

/**
 * Detect component name from stack trace for better log categorization
 */
function detectComponent(): string {
  const stack = new Error().stack || '';
  const match = stack.match(/at\s+(\w+)/);
  return match?.[1] || 'unknown';
}

export const logger = {
  info: (message: string, ...args: any[]) => {
    // Preserve original console output
    console.error(`${LOG_PREFIX} [INFO] ${message}`, ...args);

    // Also log to structured logger
    structuredLogger.info(
      LogCategory.SYSTEM,
      detectComponent(),
      'log',
      message,
      args.length > 0 ? { extraArgs: args } : undefined
    );
  },

  error: (message: string, ...args: any[]) => {
    // Preserve original console output
    console.error(`${LOG_PREFIX} [ERROR] ${message}`, ...args);

    // Extract error object if present
    const error = args.find(arg => arg instanceof Error);

    // Log to structured logger
    structuredLogger.error(
      LogCategory.SYSTEM,
      detectComponent(),
      'log',
      message,
      error,
      args.length > 0 ? { extraArgs: args } : undefined
    );
  },

  warn: (message: string, ...args: any[]) => {
    // Preserve original console output
    console.error(`${LOG_PREFIX} [WARN] ${message}`, ...args);

    // Log to structured logger
    structuredLogger.warn(
      LogCategory.SYSTEM,
      detectComponent(),
      'log',
      message,
      args.length > 0 ? { extraArgs: args } : undefined
    );
  },

  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      // Preserve original console output
      console.error(`${LOG_PREFIX} [DEBUG] ${message}`, ...args);

      // Log to structured logger
      structuredLogger.debug(
        LogCategory.SYSTEM,
        detectComponent(),
        'log',
        message,
        args.length > 0 ? { extraArgs: args } : undefined
      );
    }
  },

  progress: (message: string) => {
    // Preserve original console output
    console.error(`${LOG_PREFIX} [PROGRESS] ${message}`);

    // Log to structured logger
    structuredLogger.info(
      LogCategory.SYSTEM,
      detectComponent(),
      'progress',
      message
    );
  }
};
