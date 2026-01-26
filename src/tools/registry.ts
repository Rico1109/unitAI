import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ERROR_MESSAGES } from "../constants.js";
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
export type ToolExecuteFunction = (
  args: Record<string, any>,
  context: ToolExecutionContext
) => Promise<string>;

/**
 * Legacy tool execution function type (for backward compatibility)
 */
export type LegacyToolExecuteFunction = (
  args: Record<string, any>,
  onProgress?: ProgressCallback
) => Promise<string>;

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
export const toolRegistry: UnifiedTool[] = [];

/**
 * Register a tool
 */
export function registerTool(tool: UnifiedTool): void {
  // Check if tool already exists
  const existingIndex = toolRegistry.findIndex(t => t.name === tool.name);
  if (existingIndex !== -1) {
    // Replace existing tool
    toolRegistry[existingIndex] = tool;
  } else {
    toolRegistry.push(tool);
  }
}

/**
 * Check if a tool exists
 */
export function toolExists(name: string): boolean {
  return toolRegistry.some(tool => tool.name === name);
}

/**
 * Get all tool definitions in MCP format
 */
export function getToolDefinitions(): Tool[] {
  return toolRegistry.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.zodSchema) as any
  }));
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  args: Record<string, any>,
  onProgress?: (message: string) => void,
  requestId?: string
): Promise<string> {
  // Find the tool
  const tool = toolRegistry.find(t => t.name === name);
  if (!tool) {
    throw new Error(`${ERROR_MESSAGES.TOOL_NOT_FOUND}: ${name}`);
  }

  // Generate requestId if not provided
  const effectiveRequestId = requestId || `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Create execution context
  const context: ToolExecutionContext = {
    requestId: effectiveRequestId,
    onProgress
  };

  // Validate arguments
  try {
    const validatedArgs = tool.zodSchema.parse(args);

    // Simple approach: always pass both, tool can use what it needs
    // Legacy tools will receive (args, onProgress) where second param is a function
    // New tools will receive (args, context) where second param is an object with requestId
    // We call with the context, and if the tool expects legacy signature,
    // it will just use the onProgress property or ignore it
    return await (tool.execute as any)(validatedArgs, context);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      throw new Error(`${ERROR_MESSAGES.INVALID_ARGUMENTS}: ${errorDetails}`);
    }
    throw error;
  }
}

/**
 * Get prompt definitions for tools that have prompts
 */
export function getPromptDefinitions() {
  return toolRegistry
    .filter(tool => tool.prompt)
    .map(tool => ({
      name: tool.prompt!.name,
      description: tool.prompt!.description,
      arguments: tool.prompt!.arguments || []
    }));
}

/**
 * Get a specific tool
 */
export function getTool(name: string): UnifiedTool | undefined {
  return toolRegistry.find(t => t.name === name);
}

/**
 * Get all tools
 */
export function getAllTools(): UnifiedTool[] {
  return [...toolRegistry];
}