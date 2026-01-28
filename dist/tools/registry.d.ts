import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
/**
 * Tool execution context - provides requestId and progress callback
 */
export interface ToolExecutionContext {
    requestId: string;
    onProgress?: (message: string) => void;
}
/**
 * Progress callback type
 */
export type ProgressCallback = (message: string) => void;
/**
 * New tool execution function type with context
 */
export type ToolExecuteFunction = (args: Record<string, any>, context: ToolExecutionContext) => Promise<string>;
/**
 * Legacy tool execution function type (for backward compatibility)
 */
export type LegacyToolExecuteFunction = (args: Record<string, any>, onProgress?: ProgressCallback) => Promise<string>;
/**
 * Unified tool definition
 */
export interface UnifiedTool {
    name: string;
    description: string;
    zodSchema: z.ZodObject<any>;
    execute: ToolExecuteFunction | LegacyToolExecuteFunction;
    category?: string;
    metadata?: {
        category?: string;
        bestFor?: string[];
        notFor?: string[];
        cost?: 'low' | 'medium' | 'high';
        duration?: string;
        backends?: string[];
        relatedTools?: string[];
    };
    examples?: Array<{
        scenario: string;
        params: Record<string, any>;
    }>;
    prompt?: {
        name: string;
        description: string;
        arguments?: Array<{
            name: string;
            description: string;
            required: boolean;
        }>;
    };
}
/**
 * Global tool registry
 */
export declare const toolRegistry: UnifiedTool[];
/**
 * Register a tool
 */
export declare function registerTool(tool: UnifiedTool): void;
/**
 * Check if a tool exists
 */
export declare function toolExists(name: string): boolean;
/**
 * Get all tool definitions in MCP format
 */
export declare function getToolDefinitions(): Tool[];
/**
 * Execute a tool by name
 */
export declare function executeTool(name: string, args: Record<string, any>, onProgress?: (message: string) => void, requestId?: string): Promise<string>;
/**
 * Get prompt definitions for tools that have prompts
 */
export declare function getPromptDefinitions(): {
    name: string;
    description: string;
    arguments: {
        name: string;
        description: string;
        required: boolean;
    }[];
}[];
/**
 * Get a specific tool
 */
export declare function getTool(name: string): UnifiedTool | undefined;
/**
 * Get all tools
 */
export declare function getAllTools(): UnifiedTool[];
//# sourceMappingURL=registry.d.ts.map