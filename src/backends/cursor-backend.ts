import { IBackendExecutor, BackendExecutionOptions } from "./types.js";
import { BACKENDS, CLI, STATUS_MESSAGES } from "../constants.js";
import { executeCommand } from "../utils/cli/commandExecutor.js";
import { sanitizePrompt, validatePromptNotEmpty } from "../utils/security/promptSanitizer.js";
import { validateFilePaths } from "../utils/security/pathValidator.js";
import { logger } from "../utils/logger.js";

export class CursorBackend implements IBackendExecutor {
  readonly name = BACKENDS.CURSOR;
  readonly description = "Cursor Agent CLI integration";

  async execute(options: BackendExecutionOptions): Promise<string> {
    const {
      prompt,
      outputFormat = "text",
      attachments = [],
      autoApprove = false,
      onProgress,
      trustedSource = false
    } = options;

    // SECURITY: Validate and sanitize prompt
    validatePromptNotEmpty(prompt);
    const { sanitized: sanitizedCursor } = sanitizePrompt(prompt, {
      skipBlocking: trustedSource,
      skipRedaction: trustedSource
    });

    const args: string[] = [];

    // cursor-agent requires --print for headless/scripting mode
    args.push(CLI.FLAGS.CURSOR.PRINT);

    // Force mode allows file edits (equivalent to auto-approve)
    if (autoApprove) {
      args.push(CLI.FLAGS.CURSOR.FORCE);
    }

    if (outputFormat) {
      args.push(CLI.FLAGS.CURSOR.OUTPUT, outputFormat);
    }

    // SECURITY: Validate file paths before passing to CLI
    if (attachments.length > 0) {
      const validatedPaths = validateFilePaths(attachments);
      validatedPaths.forEach(file => {
        args.push(CLI.FLAGS.CURSOR.FILE, file);
      });
    }

    // Prompt is the last positional argument
    args.push(sanitizedCursor);

    logger.info(`Executing Cursor Agent CLI`);

    if (onProgress) {
      onProgress(STATUS_MESSAGES.STARTING_ANALYSIS);
    }

    try {
      const result = await executeCommand(CLI.COMMANDS.CURSOR_AGENT, args, {
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
      supportsFiles: true,
      supportsStreaming: true,
      supportsSandbox: false, // Not explicitly supported in CLI flags
      supportsJSON: true,
      fileMode: 'cli-flag' as const // Cursor --file means "analyze this file"
    };
  }
}
