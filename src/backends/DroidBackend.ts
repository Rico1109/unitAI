import { IBackendExecutor, BackendExecutionOptions } from "./types.js";
import { BACKENDS, CLI, STATUS_MESSAGES } from "../constants.js";
import { executeCommand } from "../utils/cli/commandExecutor.js";
import { sanitizePrompt, validatePromptNotEmpty } from "../utils/security/promptSanitizer.js";
import { validateFilePaths } from "../utils/security/pathValidator.js";
import { logger } from "../utils/logger.js";

export class DroidBackend implements IBackendExecutor {
  readonly name = BACKENDS.DROID;
  readonly description = "Factory Droid CLI (GLM-4.6) integration";

  async execute(options: BackendExecutionOptions): Promise<string> {
    const {
      prompt,
      outputFormat = "text",
      auto = "low",
      sessionId,
      skipPermissionsUnsafe = false,
      attachments = [],
      cwd,
      onProgress,
      trustedSource = false
    } = options;

    // SECURITY: Validate and sanitize prompt
    validatePromptNotEmpty(prompt);

    // For Droid, embed file references in the prompt instead of using --file flag
    // (Droid's --file means "read prompt FROM file", not "analyze this file")
    let effectivePrompt = prompt;
    if (attachments.length > 0) {
      const validatedPaths = validateFilePaths(attachments);
      const fileList = validatedPaths.join(', ');
      effectivePrompt = `[Files to analyze: ${fileList}]\n\n${prompt}`;
    }

    const { sanitized: sanitizedDroid } = sanitizePrompt(effectivePrompt, {
      skipBlocking: trustedSource,
      skipRedaction: trustedSource
    });

    const args: string[] = [];
    args.push(CLI.FLAGS.DROID.EXEC);

    if (outputFormat) {
      args.push(CLI.FLAGS.DROID.OUTPUT, outputFormat);
    }

    if (auto) {
      args.push(CLI.FLAGS.DROID.AUTO, auto);
    }

    if (sessionId) {
      args.push(CLI.FLAGS.DROID.SESSION, sessionId);
    }

    if (skipPermissionsUnsafe) {
      args.push(CLI.FLAGS.DROID.SKIP_PERMISSIONS);
    }

    if (cwd) {
      args.push(CLI.FLAGS.DROID.CWD, cwd);
    }

    // NOTE: We do NOT use --file for attachments because Droid's --file means
    // "read the prompt FROM this file", not "analyze this file"
    // File references are embedded in the prompt above

    // Prompt is positional argument at end
    args.push(sanitizedDroid);

    logger.info(`Executing Droid CLI (auto=${auto})`);

    if (onProgress) {
      onProgress(STATUS_MESSAGES.STARTING_ANALYSIS);
    }

    try {
      const result = await executeCommand(CLI.COMMANDS.DROID, args, {
        onProgress,
        timeout: 900000
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
      supportsFiles: true,
      supportsStreaming: true,
      supportsSandbox: false,
      supportsJSON: true,
      fileMode: 'embed-in-prompt' as const // Droid --file means "read prompt FROM file", so we embed file refs in prompt
    };
  }
}
