/**
 * Example Tool — Boilerplate for adding a new unitAI tool
 *
 * HOW TO ADD A NEW TOOL IN 3 STEPS:
 *
 *   1. DEFINE: Copy this file, rename it `your-tool.tool.ts`, and fill in the
 *              `name`, `description`, `zodSchema`, and `execute` function below.
 *
 *   2. IMPLEMENT: Write your logic inside `execute`. Use `onProgress` to stream
 *                 status messages back to the MCP client. Throw on errors —
 *                 the registry handles wrapping them into MCP error responses.
 *
 *   3. REGISTER: Import your tool in `src/tools/index.ts` and add it to the
 *                `TOOLS` array alongside the existing tools.
 *
 * That's it. The Zod schema is automatically converted to JSON Schema for the
 * MCP ListTools response — no manual schema writing required.
 */

import { z } from "zod";
import type { UnifiedTool, ToolExecutionContext } from "./registry.js";
import { logger } from "../utils/logger.js";

// -----------------------------------------------------------------------------
// STEP 1 — Define the schema and metadata
// -----------------------------------------------------------------------------

export const exampleTool: UnifiedTool = {
  // Unique kebab-case identifier exposed to the MCP client
  name: "example-tool",

  // Shown to the AI client as the tool's capability description
  description: "A short description of what this tool does",

  // Optional: group tools for filtering/display purposes
  category: "utility",

  // Zod schema — becomes the JSON Schema for MCP automatically.
  // Every field should have a .describe() call so the AI understands it.
  zodSchema: z.object({
    message: z
      .string()
      .min(1)
      .describe("The input message to process"),
    dryRun: z
      .boolean()
      .default(false)
      .describe("If true, validate inputs but skip side effects"),
  }),

  // -----------------------------------------------------------------------------
  // STEP 2 — Implement execute()
  // -----------------------------------------------------------------------------

  execute: async (args: Record<string, any>, context: ToolExecutionContext): Promise<string> => {
    const { message, dryRun } = args;
    const { requestId, onProgress } = context;

    logger.info(`Executing example-tool [requestId: ${requestId}]`);

    // Stream progress updates back to the MCP client
    onProgress?.(`Starting example-tool [${requestId}]`);

    if (dryRun) {
      return `[dry-run] Would process: "${message}"`;
    }

    // --- Your logic here ---
    const result = `Processed: ${message}`;

    onProgress?.(`Done [${requestId}]`);
    return result;
  },

  // Optional: MCP prompt definition (used by some MCP clients for slash commands)
  prompt: {
    name: "example-tool",
    description: "Run the example tool",
    arguments: [
      { name: "message", description: "Input message", required: true },
      { name: "dryRun",  description: "Skip side effects", required: false },
    ],
  },
};
