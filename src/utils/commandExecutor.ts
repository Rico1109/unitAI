import { spawn } from "child_process";
import path from "path";
import { logger } from "./logger.js";

/**
 * Execute a command and return the output
 */

// SECURITY: Whitelist of allowed executables to prevent arbitrary command execution
const ALLOWED_COMMANDS: Record<string, string> = {
  gemini: "gemini",
  droid: "droid",
  qwen: "qwen",
  "cursor-agent": "cursor-agent",
  rovodev: "rovodev",
  acli: "acli",  // Rovodev wrapper
  git: "git",
  npm: "npm",
  which: "which",
};

// Commands that accept free-form prompts (exempt from strict arg validation)
const AI_BACKEND_COMMANDS = new Set([
  "gemini",
  "droid",
  "qwen",
  "cursor-agent",
  "rovodev",
  "acli"
]);

// SECURITY: Dangerous argument patterns that indicate injection attempts
// NOTE: More relaxed for AI backend prompts (they use shell:false)
const DANGEROUS_PATTERNS = [
  /[;&|`]/,        // Shell metacharacters (removed $ and () for prompts)
  /\.\.\//,        // Path traversal
];

/**
 * SECURITY: Validate command against whitelist
 */
function validateCommand(command: string): string {
  const allowed = ALLOWED_COMMANDS[command];
  if (!allowed) {
    throw new Error(`Command not allowed: ${command}`);
  }
  return allowed;
}

/**
 * SECURITY: Validate arguments for dangerous patterns
 * AI backend commands are exempt since they accept natural language prompts
 */
function validateArgs(command: string, args: string[]): string[] {
  // Skip validation for AI backends (they accept prompts with parentheses, etc.)
  if (AI_BACKEND_COMMANDS.has(command)) {
    return args;
  }

  // Strict validation for system commands (git, npm, etc.)
  return args.map((arg) => {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(arg)) {
        throw new Error(`Dangerous argument pattern detected: ${arg}`);
      }
    }
    return arg;
  });
}

/**
 * SECURITY: Validate working directory to prevent path traversal
 */
function validateCwd(cwd: string | undefined): string {
  if (!cwd) return process.cwd();

  const resolved = path.resolve(cwd);
  const projectRoot = path.resolve(process.cwd());

  if (!resolved.startsWith(projectRoot)) {
    throw new Error(`Working directory outside project: ${cwd}`);
  }

  if (resolved.includes("..")) {
    throw new Error(`Path traversal in cwd: ${cwd}`);
  }

  return resolved;
}

export interface ExecutionResult {
  output: string;
  exitCode: number | null;
  signal: string | null;
  error?: Error;
}

export interface ExecutionOptions {
  onProgress?: (output: string) => void;
  timeout?: number;
  cwd?: string;
}

export async function executeCommand(
  command: string,
  args: string[],
  options: ExecutionOptions = {}
): Promise<string> {
  const { onProgress, timeout = 600000, cwd } = options; // 10 minute default timeout

  // SECURITY: Validate all inputs before execution
  const safeCommand = validateCommand(command);
  const safeArgs = validateArgs(command, args);
  const safeCwd = validateCwd(cwd);

  return new Promise((resolve, reject) => {
    logger.debug(`Executing: ${safeCommand} ${safeArgs.join(" ")}`);

    let stdout = "";
    let stderr = "";
    let progressInterval: NodeJS.Timeout | null = null;

    const child = spawn(safeCommand, safeArgs, {
      shell: false,
      cwd: safeCwd,
      stdio: ["pipe", "pipe", "pipe"]  // Changed from "ignore" to "pipe" for stdin
    });

    // Close stdin immediately - we don't need to send input
    // This prevents child processes from hanging waiting for input
    child.stdin?.end();

    // Progress monitoring
    if (onProgress) {
      progressInterval = setInterval(() => {
        const preview = stdout.slice(-200) || stderr.slice(-200);
        logger.progress(
          `Executing... (stdout: ${stdout.length} chars, stderr: ${stderr.length} chars) Latest: ${preview.slice(-100)}`
        );
      }, 5000);
    }

    // Timeout handling
    const timeoutHandle = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    // Capture stdout
    child.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      if (onProgress) {
        onProgress(chunk);
      }
    });

    // Capture stderr
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle process errors
    child.on("error", (error: Error) => {
      clearTimeout(timeoutHandle);
      if (progressInterval) clearInterval(progressInterval);
      logger.error(`Command error: ${error.message}`);
      reject(error);
    });

    // Handle process exit
    child.on("close", (exitCode: number | null, signal: string | null) => {
      clearTimeout(timeoutHandle);
      if (progressInterval) clearInterval(progressInterval);

      logger.debug(`Command exited with code ${exitCode}, signal ${signal}`);

      if (exitCode !== 0) {
        const errorMsg = `Command failed with exit code ${exitCode}: ${stderr}`;
        logger.error(errorMsg);
        reject(new Error(errorMsg));
      } else {
        resolve(stdout);
      }
    });
  });
}