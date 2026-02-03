import { IBackendExecutor, BackendExecutionOptions } from "./types.js";
import { BACKENDS, CLI, STATUS_MESSAGES } from "../constants.js";
import { executeCommand } from "../utils/cli/commandExecutor.js";
import { sanitizePrompt, validatePromptNotEmpty } from "../utils/security/promptSanitizer.js";
import { logger } from "../utils/logger.js";

export class QwenBackend implements IBackendExecutor {
  readonly name = BACKENDS.QWEN;
  readonly description = "Qwen CLI integration";

  async execute(options: BackendExecutionOptions): Promise<string> {
    const {
      prompt,
      sandbox,
      autoApprove,
      outputFormat,
      onProgress,
      trustedSource = false
    } = options;

    // SECURITY: Validate and sanitize prompt
    validatePromptNotEmpty(prompt);
    const { sanitized: sanitizedQwen } = sanitizePrompt(prompt, {
      skipBlocking: trustedSource,
      skipRedaction: trustedSource
    });

    const args: string[] = [];

    // Sandbox mode
    if (sandbox) {
      args.push(CLI.FLAGS.QWEN.SANDBOX);
    }

    // Auto-approve mode (YOLO)
    if (autoApprove) {
      args.push(CLI.FLAGS.QWEN.YOLO);
    }

    // Output format
    if (outputFormat) {
      args.push(CLI.FLAGS.QWEN.OUTPUT, outputFormat);
    }

    // Prompt is positional argument at end
    args.push(sanitizedQwen);

    logger.info(`Executing Qwen CLI`);

    if (onProgress) {
      onProgress(STATUS_MESSAGES.STARTING_ANALYSIS);
    }

    try {
      const result = await executeCommand("qwen", args, {
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
      supportsFiles: false, // Qwen CLI implementation here doesn't show file support
      supportsStreaming: true,
      supportsSandbox: true,
      supportsJSON: true,
      fileMode: 'none' as const
    };
  }
}
