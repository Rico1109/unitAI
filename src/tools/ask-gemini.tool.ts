import { z } from "zod";
import { AI_MODELS, ERROR_MESSAGES, BACKENDS } from "../constants.js";
import { executeAIClient } from "../services/ai-executor.js";
import type { UnifiedTool, ToolExecutionContext } from "./registry.js";
import { logger } from "../utils/logger.js";

/**
 * Ask Gemini tool - main interaction with Gemini CLI
 *
 * MIGRATED: Now uses ToolExecutionContext with requestId tracking
 */
export const askGeminiTool: UnifiedTool = {
  name: "ask-gemini",
  description:
    "Query Google Gemini via the gemini CLI with support for @file/#file syntax, sandbox mode, and model selection",
  category: "ai-client",
  zodSchema: z.object({
    prompt: z
      .string()
      .min(1)
      .describe(
        "Query for Gemini. Use @filename or #filename to include files"
      ),
    // model: z.enum([...]).optional(), // REMOVED
    sandbox: z
      .boolean()
      .default(false)
      .describe("Sandbox mode for safe execution"),
  }),
  execute: async (args: Record<string, any>, context: ToolExecutionContext) => {
    const { prompt, sandbox } = args;
    const { requestId, onProgress } = context;

    logger.info(`Executing Gemini [requestId: ${requestId}]`);

    if (!prompt || !prompt.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    // Progress callback with requestId context
    onProgress?.(`Starting Gemini analysis [${requestId}]`);

    const result = await executeAIClient({
      backend: BACKENDS.GEMINI,
      prompt,
      // model,
      sandbox,
      onProgress
      // TODO: Pass requestId to executeAIClient (will be added in QW4)
    });

    return result;
  },
  prompt: {
    name: "ask-gemini",
    description:
      "Query Google Gemini with @file support",
    arguments: [
      {
        name: "prompt",
        description:
          "Query. Use @filename to reference files",
        required: true
      },
      // {
      //   name: "model",
      //   description: "Model",
      //   required: false
      // },
      {
        name: "sandbox",
        description: "Sandbox mode",
        required: false
      }
    ]
  }
};
