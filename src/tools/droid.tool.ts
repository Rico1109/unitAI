import { z } from "zod";
import { AI_MODELS, BACKENDS, ERROR_MESSAGES } from "../constants.js";
import { executeAIClient } from "../services/ai-executor.js";
import type { UnifiedTool, ToolExecutionContext } from "./registry.js";
import { AutonomyLevel } from "../utils/security/permissionManager.js";
import { CONFIG } from "../config.js";

// const droidModels = [AI_MODELS.DROID.PRIMARY] as const;

const droidSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe("Prompt to pass to droid exec"),
  // model: z.enum(droidModels).optional(), // REMOVED
  auto: z
    .enum(["low", "medium", "high"])
    .default("low")
    .describe("Autonomy level (--auto)"),
  outputFormat: z
    .enum(["text", "json"])
    .default("text")
    .describe("Output format"),
  sessionId: z
    .string()
    .optional()
    .describe("Session ID to continue previous conversations"),
  skipPermissionsUnsafe: z
    .boolean()
    .default(false)
    .describe("Set --skip-permissions-unsafe (HIGH autonomy only)"),
  files: z
    .array(z.string())
    .optional()
    .describe("Files to attach via --file"),
  cwd: z
    .string()
    .optional()
    .describe("Working directory to pass to --cwd"),
  autonomyLevel: z
    .nativeEnum(AutonomyLevel)
    .optional()
    .describe("Workflow autonomy level (for internal enforcement)")
});

export type DroidToolParams = z.infer<typeof droidSchema>;

export const droidTool: UnifiedTool = {
  name: "droid",
  description: "Factory Droid CLI (GLM-4.6) per task agentici con livelli di autonomia configurabili",
  category: "ai-client",
  zodSchema: droidSchema,
  execute: async (args: Record<string, any>, context: ToolExecutionContext) => {
    const {
      prompt,
      auto,
      outputFormat,
      sessionId,
      skipPermissionsUnsafe,
      files,
      cwd,
      autonomyLevel
    } = args;
    const { onProgress } = context;

    if (!prompt || !prompt.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    // SECURITY: Permission bypass validation
    if (skipPermissionsUnsafe) {
      // Check 1: Only allowed with HIGH autonomy level
      if (autonomyLevel !== AutonomyLevel.HIGH) {
        throw new Error(
          "Flag --skip-permissions-unsafe allowed only with autonomyLevel=high"
        );
      }

      // Check 2: NEVER allow in production environment
      if (CONFIG.runtime.isProduction) {
        throw new Error(
          "Permission bypass not allowed in production environment"
        );
      }

      // Check 3: Require explicit opt-in via environment variable
      if (!CONFIG.security.allowPermissionBypass) {
        throw new Error(
          "Permission bypass requires UNITAI_ALLOW_PERMISSION_BYPASS=true environment variable"
        );
      }

      // Log warning if bypass is enabled
      console.warn(
        "⚠️  WARNING: Permission bypass enabled - NOT FOR PRODUCTION USE"
      );
    }

    return executeAIClient({
      backend: BACKENDS.DROID,
      prompt,
      // model,
      outputFormat,
      auto,
      sessionId,
      skipPermissionsUnsafe,
      attachments: files,
      cwd,
      onProgress
    });
  },
  prompt: {
    name: "droid",
    description: "Execute Factory Droid (GLM-4.6) for multi-step agentic tasks",
    arguments: [
      {
        name: "prompt",
        description: "Main prompt to execute",
        required: true
      },
      {
        name: "auto",
        description: "Autonomy level (low/medium/high)",
        required: false
      },
      {
        name: "sessionId",
        description: "Existing session to resume",
        required: false
      }
    ]
  }
};

