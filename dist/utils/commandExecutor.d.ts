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
export declare function executeCommand(command: string, args: string[], options?: ExecutionOptions): Promise<string>;
//# sourceMappingURL=commandExecutor.d.ts.map