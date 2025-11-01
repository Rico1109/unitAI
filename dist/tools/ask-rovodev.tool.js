import { z } from "zod";
import { AI_MODELS, APPROVAL_MODES, ERROR_MESSAGES, BACKENDS } from "../constants.js";
import { executeAIClient } from "../utils/aiExecutor.js";
/**
 * Ask Rovodev tool - main interaction with acli rovodev
 */
export const askRovodevTool = {
    name: "ask-rovodev",
    description: "Query Rovodev AI with support for file analysis (@file or #file syntax), codebase exploration, and large context windows. Supports various models and execution modes.",
    category: "ai-client",
    zodSchema: z.object({
        prompt: z
            .string()
            .min(1)
            .describe("The query or instruction for Rovodev. Use @filename, #filename, or directory references to include file contents. Example: '@src/ Explain this codebase structure'"),
        model: z
            .enum([
            AI_MODELS.ROVODEV.PRIMARY,
            AI_MODELS.ROVODEV.FALLBACK
        ])
            .optional()
            .describe(`Optional model to use (e.g., '${AI_MODELS.ROVODEV.PRIMARY}'). If not specified, uses the default model configured in Rovo Dev.`),
        approvalMode: z
            .enum([
            APPROVAL_MODES.PLAN,
            APPROVAL_MODES.DEFAULT,
            APPROVAL_MODES.AUTO_EDIT,
            APPROVAL_MODES.YOLO
        ])
            .optional()
            .describe("Control tool execution approval: 'plan' (analyze only), 'default' (prompt for approval), 'auto-edit' (auto-approve edits), 'yolo' (auto-approve all)"),
        yolo: z
            .boolean()
            .default(false)
            .describe("Enable YOLO mode to automatically approve all tool calls without prompting (equivalent to approvalMode='yolo')"),
        allFiles: z
            .boolean()
            .default(false)
            .describe("Include all files in the current directory as context (use with caution for large directories)"),
        debug: z
            .boolean()
            .default(false)
            .describe("Enable debug mode for more verbose output"),
        shadow: z
            .boolean()
            .default(false)
            .describe("Enable shadow mode for safe changes on temporary workspace copy"),
        verbose: z
            .boolean()
            .default(false)
            .describe("Enable verbose tool output"),
        restore: z
            .boolean()
            .default(false)
            .describe("Continue the last session if available instead of starting a new one"),
        codeMode: z
            .boolean()
            .default(false)
            .describe("Enable code-specific analysis mode for better code understanding"),
        reviewMode: z
            .boolean()
            .default(false)
            .describe("Enable code review mode for detailed feedback"),
        optimize: z
            .boolean()
            .default(false)
            .describe("Request optimization suggestions for the code"),
        explain: z
            .boolean()
            .default(false)
            .describe("Request detailed explanations of code functionality")
    }),
    execute: async (args, onProgress) => {
        const { prompt, model, approvalMode, yolo, allFiles, debug, shadow, verbose, restore, codeMode, reviewMode, optimize, explain } = args;
        // Validate prompt
        if (!prompt || !prompt.trim()) {
            throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
        }
        // Execute Rovodev CLI
        const result = await executeAIClient({
            backend: BACKENDS.ROVODEV,
            prompt,
            model,
            approvalMode,
            yolo,
            allFiles,
            debug,
            shadow,
            verbose,
            restore,
            codeMode,
            reviewMode,
            optimize,
            explain,
            onProgress
        });
        return result;
    },
    prompt: {
        name: "ask-rovodev",
        description: "Interact with Rovodev AI for code analysis, file exploration, and general queries. Supports @file or #file references for including file contents.",
        arguments: [
            {
                name: "prompt",
                description: "Your question or instruction. Use @filename or #filename to reference files.",
                required: true
            },
            {
                name: "model",
                description: `Optional model selection (${AI_MODELS.ROVODEV.PRIMARY}, ${AI_MODELS.ROVODEV.FALLBACK})`,
                required: false
            },
            {
                name: "approvalMode",
                description: "Control approval for tool execution (plan/default/auto-edit/yolo)",
                required: false
            },
            {
                name: "shadow",
                description: "Enable shadow mode for safe changes",
                required: false
            },
            {
                name: "verbose",
                description: "Enable verbose output",
                required: false
            },
            {
                name: "restore",
                description: "Continue last session",
                required: false
            },
            {
                name: "codeMode",
                description: "Enable code-specific analysis mode",
                required: false
            },
            {
                name: "reviewMode",
                description: "Enable detailed code review mode",
                required: false
            },
            {
                name: "optimize",
                description: "Request optimization suggestions",
                required: false
            },
            {
                name: "explain",
                description: "Request detailed explanations",
                required: false
            }
        ]
    }
};
//# sourceMappingURL=ask-rovodev.tool.js.map