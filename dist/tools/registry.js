import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ERROR_MESSAGES } from "../constants.js";
/**
 * Global tool registry
 */
export const toolRegistry = [];
/**
 * Register a tool
 */
export function registerTool(tool) {
    // Check if tool already exists
    const existingIndex = toolRegistry.findIndex(t => t.name === tool.name);
    if (existingIndex !== -1) {
        // Replace existing tool
        toolRegistry[existingIndex] = tool;
    }
    else {
        toolRegistry.push(tool);
    }
}
/**
 * Check if a tool exists
 */
export function toolExists(name) {
    return toolRegistry.some(tool => tool.name === name);
}
/**
 * Get all tool definitions in MCP format
 */
export function getToolDefinitions() {
    return toolRegistry.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.zodSchema)
    }));
}
/**
 * Execute a tool by name
 */
export async function executeTool(name, args, onProgress, requestId) {
    // Find the tool
    const tool = toolRegistry.find(t => t.name === name);
    if (!tool) {
        throw new Error(`${ERROR_MESSAGES.TOOL_NOT_FOUND}: ${name}`);
    }
    // Generate requestId if not provided
    const effectiveRequestId = requestId || `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    // Create execution context
    const context = {
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
        return await tool.execute(validatedArgs, context);
    }
    catch (error) {
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
        name: tool.prompt.name,
        description: tool.prompt.description,
        arguments: tool.prompt.arguments || []
    }));
}
/**
 * Get a specific tool
 */
export function getTool(name) {
    return toolRegistry.find(t => t.name === name);
}
/**
 * Get all tools
 */
export function getAllTools() {
    return [...toolRegistry];
}
//# sourceMappingURL=registry.js.map