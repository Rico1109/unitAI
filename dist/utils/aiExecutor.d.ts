import type { ApprovalMode } from "../constants.js";
/**
 * Options for executing AI CLI commands
 */
export interface AIExecutionOptions {
    backend: string;
    prompt: string;
    model?: string;
    sandbox?: boolean;
    approvalMode?: ApprovalMode;
    yolo?: boolean;
    allFiles?: boolean;
    debug?: boolean;
    shadow?: boolean;
    verbose?: boolean;
    restore?: boolean;
    codeMode?: boolean;
    reviewMode?: boolean;
    optimize?: boolean;
    explain?: boolean;
    onProgress?: (output: string) => void;
}
/**
 * Execute Qwen CLI with the given options
 */
export declare function executeQwenCLI(options: Omit<AIExecutionOptions, 'backend'>): Promise<string>;
/**
 * Execute Rovodev CLI with the given options
 */
export declare function executeRovodevCLI(options: Omit<AIExecutionOptions, 'backend'>): Promise<string>;
/**
 * Execute a simple command (like echo or help)
 */
export declare function executeSimpleCommand(command: string, args?: string[]): Promise<string>;
/**
 * Main function to execute an AI command based on backend
 */
export declare function executeAIClient(options: AIExecutionOptions): Promise<string>;
//# sourceMappingURL=aiExecutor.d.ts.map