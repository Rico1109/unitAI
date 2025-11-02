import { z } from "zod";
import { AI_MODELS, APPROVAL_MODES, ERROR_MESSAGES, BACKENDS } from "../constants.js";
import { executeAIClient } from "../utils/aiExecutor.js";
import type { UnifiedTool } from "./registry.js";

/**
 * Ask Qwen tool - main interaction with Qwen CLI
 */
export const askQwenTool: UnifiedTool = {
  name: "ask-qwen",
  description: "Query Qwen AI with support for file analysis (@file or #file syntax), codebase exploration, and large context windows",
  category: "ai-client",
  zodSchema: z.object({
    prompt: z
      .string()
      .min(1)
      .describe(
        "Query for Qwen. Use @filename or #filename to include files"
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
        `Model to use (default: ${AI_MODELS.QWEN.PRIMARY})`
      ),
    sandbox: z
      .boolean()
      .default(false)
      .describe(
        "Use sandbox mode for safe code execution"
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
        "Approval mode: plan/default/auto-edit/yolo"
      ),
    yolo: z
      .boolean()
      .default(false)
      .describe(
        "Auto-approve all operations"
      )
  }),
  execute: async (args, onProgress) => {
    const { prompt, model, sandbox, approvalMode, yolo } = args;

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
      onProgress
    });

    return result;
  },
  prompt: {
    name: "ask-qwen",
    description:
      "Query Qwen AI with @file support",
    arguments: [
      {
        name: "prompt",
        description:
          "Query. Use @filename to reference files",
        required: true
      },
      {
        name: "model",
        description: `Model (default: ${AI_MODELS.QWEN.PRIMARY})`,
        required: false
      },
      {
        name: "sandbox",
        description: "Sandbox mode",
        required: false
      },
      {
        name: "approvalMode",
        description: "Approval mode",
        required: false
      }
    ]
  }
};