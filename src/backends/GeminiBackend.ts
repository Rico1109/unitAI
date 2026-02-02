import { IBackendExecutor, BackendExecutionOptions } from "./types.js";
import { BACKENDS, CLI, STATUS_MESSAGES, AI_MODELS } from "../constants.js";
import { executeCommand } from "../utils/cli/commandExecutor.js";
import { sanitizePrompt, validatePromptNotEmpty } from "../utils/security/promptSanitizer.js";
import { logger } from "../utils/logger.js";

export class GeminiBackend implements IBackendExecutor {
  readonly name = BACKENDS.GEMINI;
  readonly description = "Google Gemini CLI integration";

  async execute(options: BackendExecutionOptions): Promise<string> {
    const { prompt, sandbox = false, onProgress, trustedSource = false } = options;

    // SECURITY: Validate and sanitize prompt
    validatePromptNotEmpty(prompt);
    const { sanitized } = sanitizePrompt(prompt, {
      skipBlocking: trustedSource,
      skipRedaction: trustedSource
    });

    const args: string[] = [];

    // Always pass a model: default to PRIMARY if none provided
    const effectiveModel = options.model ?? AI_MODELS.GEMINI.PRIMARY;
    args.push(CLI.FLAGS.GEMINI.MODEL, effectiveModel);

    // Sandbox flag
    if (sandbox) {
      args.push(CLI.FLAGS.GEMINI.SANDBOX);
    }

    // Prompt as positional argument
    args.push(sanitized);

    logger.info(`Executing Gemini CLI`);

    if (onProgress) {
      onProgress(STATUS_MESSAGES.STARTING_ANALYSIS);
    }

    try {
      const result = await executeCommand(CLI.COMMANDS.GEMINI, args, {
        onProgress,
        timeout: 600000
      });

      if (onProgress) onProgress(STATUS_MESSAGES.COMPLETED);
      return result;
    } catch (error) {
      if (onProgress) onProgress(STATUS_MESSAGES.FAILED);
      throw error;
    }
  }

  getCapabilities() {
    return {
      supportsFiles: false, // Gemini CLI currently takes prompt as arg, doesn't seem to have direct file attachment flag in this wrapper version
      supportsStreaming: true, // onProgress is supported
      supportsSandbox: true,
      supportsJSON: false
    };
  }
}
