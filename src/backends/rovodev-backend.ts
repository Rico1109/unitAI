import { IBackendExecutor, BackendExecutionOptions } from "./types.js";
import { BACKENDS, CLI, STATUS_MESSAGES } from "../constants.js";
import { executeCommand } from "../utils/cli/commandExecutor.js";
import { sanitizePrompt, validatePromptNotEmpty } from "../utils/security/promptSanitizer.js";
import { logger } from "../utils/logger.js";
import { AutonomyLevel } from "../utils/security/permissionManager.js";
import { CONFIG } from "../config.js";

export class RovodevBackend implements IBackendExecutor {
  readonly name = BACKENDS.ROVODEV;
  readonly description = "Rovodev CLI integration via acli";

  async execute(options: BackendExecutionOptions): Promise<string> {
    const { prompt, autoApprove, onProgress, trustedSource = false, autonomyLevel } = options;

    // SECURITY: Validate and sanitize prompt
    validatePromptNotEmpty(prompt);
    const { sanitized: sanitizedRovo } = sanitizePrompt(prompt, {
      skipBlocking: trustedSource,
      skipRedaction: trustedSource
    });

    const args: string[] = [];
    args.push(CLI.FLAGS.ROVODEV.RUN);

    // Auto-approve mode (YOLO)
    if (autoApprove) {
      // SAFEGUARD: Only allow autoApprove if strict conditions are met
      const isHighAutonomy = autonomyLevel === AutonomyLevel.HIGH;
      const isExplicitlyAllowed = CONFIG.security.allowAutoApprove;
      const isNotProduction = !CONFIG.runtime.isProduction;

      if (isHighAutonomy && isExplicitlyAllowed && isNotProduction) {
        args.push(CLI.FLAGS.ROVODEV.YOLO);
      } else {
        logger.warn("Auto-approve request denied by safeguards. Requires HIGH autonomy, UNITAI_ALLOW_AUTO_APPROVE=true, and non-production env.");
      }
    }

    // Prompt is positional argument at end
    args.push(sanitizedRovo);

    logger.info(`Executing Rovodev CLI`);

    if (onProgress) {
      onProgress(STATUS_MESSAGES.STARTING_ANALYSIS);
    }

    try {
      const result = await executeCommand("acli", ["rovodev", ...args], {
        onProgress,
        timeout: 600000
      });

      if (onProgress) {
        onProgress(STATUS_MESSAGES.COMPLETED);
      }

      return result;
    } catch (error) {
      if (onProgress) {
        onProgress(STATUS_MESSAGES.FAILED);
      }
      throw error;
    }
  }

  getCapabilities() {
    return {
      supportsFiles: false,
      supportsStreaming: true,
      supportsSandbox: false,
      supportsJSON: false,
      fileMode: 'none' as const
    };
  }
}
