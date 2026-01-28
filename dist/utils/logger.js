/**
 * DEPRECATED: Use structuredLogger.ts directly for new code
 *
 * This file now re-exports legacyLogger for backward compatibility.
 * All logs are now sent to both console (stderr) AND structured log files.
 *
 * Migration path:
 * - Old code: import { logger } from './utils/logger.js';
 * - New code: import { structuredLogger } from './utils/structuredLogger.js';
 *
 * The logger API remains unchanged for backward compatibility.
 */
export { logger } from './legacyLogger.js';
//# sourceMappingURL=logger.js.map