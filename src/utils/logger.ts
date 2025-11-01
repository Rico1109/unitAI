import { LOG_PREFIX } from "../constants.js";

/**
 * Logger utility for consistent logging across the application
 */

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.error(`${LOG_PREFIX} [INFO] ${message}`, ...args);
  },

  error: (message: string, ...args: any[]) => {
    console.error(`${LOG_PREFIX} [ERROR] ${message}`, ...args);
  },

  warn: (message: string, ...args: any[]) => {
    console.error(`${LOG_PREFIX} [WARN] ${message}`, ...args);
  },

  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      console.error(`${LOG_PREFIX} [DEBUG] ${message}`, ...args);
    }
  },

  progress: (message: string) => {
    console.error(`${LOG_PREFIX} [PROGRESS] ${message}`);
  }
};