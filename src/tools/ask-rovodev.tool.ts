import { z } from "zod";
import { AI_MODELS, APPROVAL_MODES, ERROR_MESSAGES, BACKENDS } from "../constants.js";
import { executeAIClient } from "../utils/aiExecutor.js";
import type { UnifiedTool } from "./registry.js";

/**
 * Ask Rovodev tool - main interaction with acli rovodev
 */
export const askRovodevTool: UnifiedTool = {
  name: "ask-rovodev",
  description: "Query Rovodev AI with support for file analysis (@file or #file syntax), codebase exploration, and large context windows",
  category: "ai-client",
  zodSchema: z.object({
    prompt: z
      .string()
      .min(1)
      .describe(
        "Query for Rovodev. Use @filename or #filename to include files"
      ),
    yolo: z
      .boolean()
      .default(false)
      .describe(
        "Auto-approve all operations"
      ),
    shadow: z
      .boolean()
      .default(false)
      .describe("Shadow mode for safe changes"),
    verbose: z
      .boolean()
      .default(false)
      .describe("Verbose output"),
    restore: z
      .boolean()
      .default(false)
      .describe("Continue last session")
  }),
  execute: async (args, onProgress) => {
    const { prompt, yolo, shadow, verbose, restore } = args;

    // Validate prompt
    if (!prompt || !prompt.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    // Execute Rovodev CLI (only passing supported parameters)
    const result = await executeAIClient({
      backend: BACKENDS.ROVODEV,
      prompt,
      yolo,
      shadow,
      verbose,
      restore,
      onProgress
    });

    return result;
  },
  prompt: {
    name: "ask-rovodev",
    description:
      "Query Rovodev AI with @file support",
    arguments: [
      {
        name: "prompt",
        description:
          "Query. Use @filename to reference files",
        required: true
      },
      {
        name: "yolo",
        description: "Auto-approve all",
        required: false
      },
      {
        name: "shadow",
        description: "Shadow mode",
        required: false
      },
      {
        name: "verbose",
        description: "Verbose output",
        required: false
      },
      {
        name: "restore",
        description: "Continue session",
        required: false
      }
    ]
  }
};