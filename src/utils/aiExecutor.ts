import { CLI, AI_MODELS, ERROR_MESSAGES, STATUS_MESSAGES, BACKENDS } from "../constants.js";

// Re-export BACKENDS for convenience
export { BACKENDS };
import { executeCommand } from "./commandExecutor.js";
import { logger } from "./logger.js";
import type { GeminiModel } from "../constants.js";

/**
 * Options for executing AI CLI commands
 */
export interface AIExecutionOptions {
  backend: string;
  prompt: string;
  // Common options
  model?: string; // Model name
  sandbox?: boolean; // Sandbox flag (Gemini)
  outputFormat?: "text" | "json"; // Cursor Agent / Droid preferred format
  projectRoot?: string; // Cursor Agent working directory
  attachments?: string[]; // Shared attachment mechanism
  autoApprove?: boolean; // Cursor Agent auto-approve flag
  autonomyLevel?: string; // Cursor Agent autonomy level flag
  // Droid-specific options
  auto?: "low" | "medium" | "high";
  sessionId?: string;
  skipPermissionsUnsafe?: boolean;
  cwd?: string;
  onProgress?: (output: string) => void;
}

/**
 * Execute Gemini CLI with the given options
 */
export async function executeGeminiCLI(
  options: Omit<AIExecutionOptions, 'backend'>
): Promise<string> {
  const { prompt, model, sandbox = false, onProgress } = options;

  if (!prompt || !prompt.trim()) {
    throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
  }

  const args: string[] = [];

  // Always pass a model: default to PRIMARY if none provided
  const effectiveModel = model ?? AI_MODELS.GEMINI.PRIMARY;
  args.push(CLI.FLAGS.GEMINI.MODEL, effectiveModel);

  // Sandbox flag
  if (sandbox) {
    args.push(CLI.FLAGS.GEMINI.SANDBOX);
  }

  // Prompt as positional argument (FIXED: -p flag is deprecated in Gemini CLI)
  // No need to manually quote - spawn with shell:false handles special characters
  args.push(prompt);

  logger.info(`Executing Gemini CLI with model: ${effectiveModel}`);

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

/**
 * Execute Cursor Agent CLI with the given options
 */
export async function executeCursorAgentCLI(
  options: Omit<AIExecutionOptions, 'backend'>
): Promise<string> {
  const {
    prompt,
    model = AI_MODELS.CURSOR_AGENT.GPT_5_1,
    outputFormat = "text",
    projectRoot,
    attachments = [],
    autoApprove = false,
    autonomyLevel,
    onProgress
  } = options;

  if (!prompt || !prompt.trim()) {
    throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
  }

  const args: string[] = [];

  // cursor-agent requires --print for headless/scripting mode
  args.push(CLI.FLAGS.CURSOR.PRINT);

  // Force mode allows file edits (equivalent to auto-approve)
  if (autoApprove) {
    args.push(CLI.FLAGS.CURSOR.FORCE);
  }

  if (model) {
    args.push(CLI.FLAGS.CURSOR.MODEL, model);
  }

  if (outputFormat) {
    args.push(CLI.FLAGS.CURSOR.OUTPUT, outputFormat);
  }

  if (attachments.length > 0) {
    attachments.forEach(file => {
      args.push(CLI.FLAGS.CURSOR.FILE, file);
    });
  }

  // Prompt is the last positional argument
  args.push(prompt);

  logger.info(`Executing Cursor Agent CLI with model: ${model}`);

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

/**
 * Execute Droid CLI (Factory Droid) with the given options
 */
export async function executeDroidCLI(
  options: Omit<AIExecutionOptions, 'backend'>
): Promise<string> {
  const {
    prompt,
    model = AI_MODELS.DROID.PRIMARY,
    outputFormat = "text",
    auto = "low",
    sessionId,
    skipPermissionsUnsafe = false,
    attachments = [],
    cwd,
    onProgress
  } = options;

  if (!prompt || !prompt.trim()) {
    throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
  }

  const args: string[] = [];
  args.push(CLI.FLAGS.DROID.EXEC);

  if (outputFormat) {
    args.push(CLI.FLAGS.DROID.OUTPUT, outputFormat);
  }

  if (model) {
    args.push(CLI.FLAGS.DROID.MODEL, model);
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

  if (attachments.length > 0) {
    attachments.forEach(file => {
      args.push(CLI.FLAGS.DROID.FILE, file);
    });
  }

  // Prompt is positional argument at end
  args.push(prompt);

  logger.info(`Executing Droid CLI with model: ${model} (auto=${auto})`);

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

import { circuitBreaker } from "./circuitBreaker.js";

/**
 * Execute Rovodev CLI with the given options
 */
export async function executeRovodevCLI(
  options: Omit<AIExecutionOptions, 'backend'>
): Promise<string> {
  const { prompt, autoApprove, onProgress } = options;

  if (!prompt || !prompt.trim()) {
    throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
  }

  const args: string[] = [];
  args.push(CLI.FLAGS.ROVODEV.RUN);

  // Auto-approve mode (YOLO)
  if (autoApprove) {
    args.push(CLI.FLAGS.ROVODEV.YOLO);
  }

  // Prompt is positional argument at end
  args.push(prompt);

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

/**
 * Execute Qwen CLI with the given options
 */
export async function executeQwenCLI(
  options: Omit<AIExecutionOptions, 'backend'>
): Promise<string> {
  const { prompt, sandbox, autoApprove, outputFormat, onProgress } = options;

  if (!prompt || !prompt.trim()) {
    throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
  }

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
  args.push(prompt);

  logger.info(`Executing Qwen CLI`);

  if (onProgress) {
    onProgress(STATUS_MESSAGES.STARTING_ANALYSIS);
  }

  try {
    const result = await executeCommand(CLI.COMMANDS.GEMINI.replace("gemini", "qwen"), args, { // Hack: assuming qwen is in path as 'qwen'
      onProgress,
      timeout: 600000
    });
    // Correction: The command is just 'qwen'
    // Re-doing the command execution cleanly:

    return await executeCommand("qwen", args, {
      onProgress,
      timeout: 600000
    });

  } catch (error) {
    if (onProgress) {
      onProgress(STATUS_MESSAGES.FAILED);
    }
    throw error;
  }
}

/**
 * Execute a simple command (like echo or help)
 */
export async function executeSimpleCommand(
  command: string,
  args: string[] = []
): Promise<string> {
  logger.debug(`Executing simple command: ${command} ${args.join(" ")}`);
  return executeCommand(command, args);
}

/**
 * Main function to execute an AI command based on backend
 */
export async function executeAIClient(options: AIExecutionOptions): Promise<string> {
  const { backend, ...rest } = options;

  // Circuit Breaker Check
  if (!circuitBreaker.isAvailable(backend)) {
    const msg = `Backend ${backend} is currently unavailable (Circuit Open).`;
    logger.warn(msg);
    throw new Error(msg);
  }

  try {
    let result: string;
    switch (backend) {
      case BACKENDS.GEMINI:
        result = await executeGeminiCLI(rest);
        break;
      case BACKENDS.CURSOR:
        result = await executeCursorAgentCLI(rest);
        break;
      case BACKENDS.DROID:
        result = await executeDroidCLI(rest);
        break;
      case BACKENDS.ROVODEV:
        result = await executeRovodevCLI(rest);
        break;
      case BACKENDS.QWEN:
        result = await executeQwenCLI(rest);
        break;
      default:
        throw new Error(`Unsupported backend: ${backend}`);
    }

    // Report success to Circuit Breaker
    circuitBreaker.onSuccess(backend);
    return result;

  } catch (error) {
    // Report failure to Circuit Breaker
    circuitBreaker.onFailure(backend);
    throw error;
  }
}