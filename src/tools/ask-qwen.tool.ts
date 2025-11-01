import { z } from "zod";
import { AI_MODELS, APPROVAL_MODES, ERROR_MESSAGES, BACKENDS } from "../constants.js";
import { executeAIClient } from "../utils/aiExecutor.js";
import type { UnifiedTool } from "./registry.js";

/**
 * Ask Qwen tool - main interaction with Qwen CLI
 */
export const askQwenTool: UnifiedTool = {
  name: "ask-qwen",
  description: "Query Qwen AI with support for file analysis (@file or #file syntax), codebase exploration, and large context windows. Supports various models and execution modes.",
  category: "ai-client",
  zodSchema: z.object({
    prompt: z
      .string()
      .min(1)
      .describe(
        "The query or instruction for Qwen. Use @filename, #filename, or directory references to include file contents. Example: '@src/ Explain this codebase structure'"
      ),
    model: z
      .enum([
        AI_MODELS.QWEN.PRIMARY,
        AI_MODELS.QWEN.FALLBACK,
        AI_MODELS.QWEN.PLUS,
        AI_MODELS.QWEN.TURBO,
        AI_MODELS.QWEN.PRO
      ])
      .optional()
      .describe(
        `Optional model to use (e.g., '${AI_MODELS.QWEN.PRIMARY}'). If not specified, uses the default model (${AI_MODELS.QWEN.PRIMARY}).`
      ),
    sandbox: z
      .boolean()
      .default(false)
      .describe(
        "Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment"
      ),
    approvalMode: z
      .enum([
        APPROVAL_MODES.PLAN,
        APPROVAL_MODES.DEFAULT,
        APPROVAL_MODES.AUTO_EDIT,
        APPROVAL_MODES.YOLO
      ])
      .optional()
      .describe(
        "Control tool execution approval: 'plan' (analyze only), 'default' (prompt for approval), 'auto-edit' (auto-approve edits), 'yolo' (auto-approve all)"
      ),
    yolo: z
      .boolean()
      .default(false)
      .describe(
        "Enable YOLO mode to automatically approve all tool calls without prompting (equivalent to approvalMode='yolo')"
      ),
    allFiles: z
      .boolean()
      .default(false)
      .describe(
        "Include all files in the current directory as context (use with caution for large directories)"
      ),
    debug: z
      .boolean()
      .default(false)
      .describe("Enable debug mode for more verbose output")
  }),
  execute: async (args, onProgress) => {
    const { prompt, model, sandbox, approvalMode, yolo, allFiles, debug } = args;

    // Validate prompt
    if (!prompt || !prompt.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    // Execute Qwen CLI
    const result = await executeAIClient({
      backend: BACKENDS.QWEN,
      prompt,
      model,
      sandbox,
      approvalMode,
      yolo,
      allFiles,
      debug,
      onProgress
    });

    return result;
  },
  prompt: {
    name: "ask-qwen",
    description:
      "Interact with Qwen AI for code analysis, file exploration, and general queries. Supports @file or #file references for including file contents.",
    arguments: [
      {
        name: "prompt",
        description:
          "Your question or instruction. Use @filename or #filename to reference files.",
        required: true
      },
      {
        name: "model",
        description: `Optional model selection (${AI_MODELS.QWEN.PRIMARY}, ${AI_MODELS.QWEN.TURBO}, etc.)`,
        required: false
      },
      {
        name: "sandbox",
        description: "Enable sandbox mode for safe code execution",
        required: false
      },
      {
        name: "approvalMode",
        description: "Control approval for tool execution (plan/default/auto-edit/yolo)",
        required: false
      }
    ]
  }
};