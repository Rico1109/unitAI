import { CLI, AI_MODELS, ERROR_MESSAGES, STATUS_MESSAGES, BACKENDS } from "../constants.js";
import { executeCommand } from "./commandExecutor.js";
import { logger } from "./logger.js";
/**
 * Execute Qwen CLI with the given options
 */
export async function executeQwenCLI(options) {
    const { prompt, model, sandbox = false, approvalMode, yolo = false, allFiles = false, debug = false, onProgress } = options;
    if (!prompt || !prompt.trim()) {
        throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }
    // Build command arguments
    const args = [];
    // Add model flag if specified
    if (model) {
        args.push(CLI.FLAGS.QWEN.MODEL, model);
    }
    // Add sandbox flag if enabled
    if (sandbox) {
        args.push(CLI.FLAGS.QWEN.SANDBOX);
    }
    // Add approval mode if specified
    if (approvalMode) {
        args.push(CLI.FLAGS.QWEN.APPROVAL_MODE, approvalMode);
    }
    // Add yolo flag if enabled
    if (yolo) {
        args.push(CLI.FLAGS.QWEN.YOLO);
    }
    // Add all-files flag if enabled
    if (allFiles) {
        args.push(CLI.FLAGS.QWEN.ALL_FILES);
    }
    // Add debug flag if enabled
    if (debug) {
        args.push(CLI.FLAGS.QWEN.DEBUG);
    }
    // Add prompt flag with the prompt
    // Wrap in quotes if it contains @ symbols for file references
    const shouldQuote = prompt.includes("@") || prompt.includes("#");
    args.push(CLI.FLAGS.QWEN.PROMPT);
    args.push(shouldQuote ? `"${prompt}"` : prompt);
    logger.info(`Executing Qwen CLI with model: ${model || "default"}`);
    if (onProgress) {
        onProgress(STATUS_MESSAGES.STARTING_ANALYSIS);
    }
    try {
        const result = await executeCommand(CLI.COMMANDS.QWEN, args, {
            onProgress,
            timeout: 600000 // 10 minutes
        });
        if (onProgress) {
            onProgress(STATUS_MESSAGES.COMPLETED);
        }
        return result;
    }
    catch (error) {
        // Check if this is a quota/rate limit error and we used the primary model
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isQuotaError = errorMsg.toLowerCase().includes("quota") ||
            errorMsg.toLowerCase().includes("rate limit");
        // If quota error with primary model, try fallback
        if (isQuotaError && model === AI_MODELS.QWEN.PRIMARY) {
            logger.warn(STATUS_MESSAGES.SWITCHING_MODEL);
            if (onProgress) {
                onProgress(STATUS_MESSAGES.SWITCHING_MODEL);
            }
            // Retry with fallback model
            const fallbackArgs = [...args];
            const modelIndex = fallbackArgs.indexOf(CLI.FLAGS.QWEN.MODEL);
            if (modelIndex !== -1 && modelIndex + 1 < fallbackArgs.length) {
                fallbackArgs[modelIndex + 1] = AI_MODELS.QWEN.FALLBACK;
            }
            else {
                // Model wasn't specified, add it
                fallbackArgs.unshift(CLI.FLAGS.QWEN.MODEL, AI_MODELS.QWEN.FALLBACK);
            }
            try {
                const fallbackResult = await executeCommand(CLI.COMMANDS.QWEN, fallbackArgs, {
                    onProgress,
                    timeout: 600000
                });
                if (onProgress) {
                    onProgress(STATUS_MESSAGES.COMPLETED);
                }
                return fallbackResult;
            }
            catch (fallbackError) {
                const fallbackErrorMsg = fallbackError instanceof Error ?
                    fallbackError.message : String(fallbackError);
                throw new Error(`Both primary and fallback models failed:\n` +
                    `Primary: ${errorMsg}\n` +
                    `Fallback: ${fallbackErrorMsg}`);
            }
        }
        // Not a quota error or already tried fallback
        if (onProgress) {
            onProgress(STATUS_MESSAGES.FAILED);
        }
        throw error;
    }
}
/**
 * Execute Rovodev CLI with the given options
 */
export async function executeRovodevCLI(options) {
    const { prompt, model, approvalMode, yolo = false, allFiles = false, debug = false, shadow = false, verbose = false, restore = false, codeMode = false, reviewMode = false, optimize = false, explain = false, onProgress } = options;
    if (!prompt || !prompt.trim()) {
        throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }
    // Build command arguments
    const args = [];
    // Add subcommand
    args.push(CLI.COMMANDS.ROVODEV_SUBCOMMAND);
    // Add model flag if specified
    if (model) {
        args.push(CLI.FLAGS.ROVODEV.MODEL, model);
    }
    // Add approval mode if specified
    if (approvalMode) {
        args.push(CLI.FLAGS.ROVODEV.APPROVAL_MODE, approvalMode);
    }
    // Add yolo flag if enabled
    if (yolo) {
        args.push(CLI.FLAGS.ROVODEV.YOLO);
    }
    // Add all-files flag if enabled
    if (allFiles) {
        args.push(CLI.FLAGS.ROVODEV.ALL_FILES);
    }
    // Add debug flag if enabled
    if (debug) {
        args.push(CLI.FLAGS.ROVODEV.DEBUG);
    }
    // Add rovodev-specific flags if enabled
    if (shadow) {
        args.push(CLI.FLAGS.ROVODEV.SHADOW);
    }
    if (verbose) {
        args.push(CLI.FLAGS.ROVODEV.VERBOSE);
    }
    if (restore) {
        args.push(CLI.FLAGS.ROVODEV.RESTORE);
    }
    if (codeMode) {
        args.push(CLI.FLAGS.ROVODEV.CODE_MODE);
    }
    if (reviewMode) {
        args.push(CLI.FLAGS.ROVODEV.REVIEW_MODE);
    }
    if (optimize) {
        args.push(CLI.FLAGS.ROVODEV.OPTIMIZE);
    }
    if (explain) {
        args.push(CLI.FLAGS.ROVODEV.EXPLAIN);
    }
    // Add prompt flag with the prompt
    // Wrap in quotes if it contains @ symbols for file references
    const shouldQuote = prompt.includes("@") || prompt.includes("#");
    args.push(CLI.FLAGS.ROVODEV.PROMPT);
    args.push(shouldQuote ? `"${prompt}"` : prompt);
    logger.info(`Executing Rovodev CLI with model: ${model || "default"}`);
    if (onProgress) {
        onProgress(STATUS_MESSAGES.STARTING_ANALYSIS);
    }
    try {
        const result = await executeCommand(CLI.COMMANDS.ROVODEV, args, {
            onProgress,
            timeout: 600000 // 10 minutes
        });
        if (onProgress) {
            onProgress(STATUS_MESSAGES.COMPLETED);
        }
        return result;
    }
    catch (error) {
        if (onProgress) {
            onProgress(STATUS_MESSAGES.FAILED);
        }
        throw error;
    }
}
/**
 * Execute a simple command (like echo or help)
 */
export async function executeSimpleCommand(command, args = []) {
    logger.debug(`Executing simple command: ${command} ${args.join(" ")}`);
    return executeCommand(command, args);
}
/**
 * Main function to execute an AI command based on backend
 */
export async function executeAIClient(options) {
    const { backend, ...rest } = options;
    switch (backend) {
        case BACKENDS.QWEN:
            return executeQwenCLI(rest);
        case BACKENDS.ROVODEV:
            return executeRovodevCLI(rest);
        default:
            throw new Error(`Unsupported backend: ${backend}`);
    }
}
//# sourceMappingURL=aiExecutor.js.map