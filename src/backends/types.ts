import { AI_MODELS } from "../constants.js";

/**
 * Options for executing AI CLI commands
 * Copied/Adapted from original AIExecutionOptions in aiExecutor.ts
 */
export interface BackendExecutionOptions {
  prompt: string;
  // Common options
  model?: string; // Model name
  sandbox?: boolean; // Sandbox flag (Gemini, Qwen)
  outputFormat?: "text" | "json"; // Cursor Agent / Droid / Qwen preferred format
  projectRoot?: string; // Cursor Agent working directory
  attachments?: string[]; // Shared attachment mechanism
  autoApprove?: boolean; // Cursor Agent / Rovodev / Qwen auto-approve flag
  autonomyLevel?: string; // Cursor Agent autonomy level flag
  // Droid-specific options
  auto?: "low" | "medium" | "high";
  sessionId?: string;
  skipPermissionsUnsafe?: boolean;
  cwd?: string;
  onProgress?: (output: string) => void;
  // Security options
  trustedSource?: boolean; // Skip prompt sanitization blocking (for internal workflows)
  // Observability
  requestId?: string; // For request tracing and correlation
}

export interface IBackendExecutor {
  readonly name: string;
  readonly description: string;

  /**
   * Execute the AI backend with the given options
   */
  execute(options: BackendExecutionOptions): Promise<string>;

  /**
   * Get the capabilities of this backend
   */
  getCapabilities(): {
    supportsFiles: boolean;
    supportsStreaming: boolean;
    supportsSandbox: boolean;
    supportsJSON: boolean;
    /**
     * How attachments/files should be passed to this backend:
     * - 'cli-flag': Files passed via --file CLI flag (e.g., Cursor, Gemini)
     * - 'embed-in-prompt': Files should be embedded as references in prompt text (e.g., Droid)
     * - 'none': Backend doesn't support file attachments
     */
    fileMode: 'cli-flag' | 'embed-in-prompt' | 'none';
  };
}
