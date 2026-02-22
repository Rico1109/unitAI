import { z } from "zod";
import { executeWorkflow, smartWorkflowsSchema } from "../workflows/index.js";
import { resolveAutonomyLevel } from "../utils/security/permissionManager.js";
import type { ToolExecutionContext } from "./registry.js";

/**
 * Executes the requested workflow
 */
const executeSmartWorkflow = async (
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<string> => {
  const { workflow, params = {} } = args;

  // Resolve "auto" (or undefined) autonomyLevel before reaching executeWorkflow.
  // This tool bypasses executeTool() in the registry, so we must replicate
  // the resolution step here — otherwise assertPermission("auto", ...) crashes.
  if (params) {
    params.autonomyLevel = resolveAutonomyLevel(
      params.autonomyLevel ?? 'auto',
      workflow
    );
  }

  const { onProgress } = context;

  onProgress?.(`Starting workflow: ${workflow}`);

  try {
    const result = await executeWorkflow(workflow, params, onProgress);
    onProgress?.(`Workflow ${workflow} completed successfully`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onProgress?.(`Workflow ${workflow} failed: ${errorMessage}`);
    throw new Error(`Failed to execute workflow ${workflow}: ${errorMessage}`);
  }
};

/**
 * Definizione dello strumento smart-workflows
 */
export const smartWorkflowsTool = {
  name: "smart-workflows",
  description: "Smart workflows that orchestrate multiple AI backends for complex tasks such as parallel code review, pre-commit validation, and bug hunting",
  zodSchema: smartWorkflowsSchema,
  execute: executeSmartWorkflow,
  category: "workflows",
  prompt: {
    name: "smart-workflows",
    description: "Execute smart workflows that combine multiple AI backends",
    arguments: [
      {
        name: "workflow",
        description: "Name of the workflow to execute",
        required: true
      },
      {
        name: "params",
        description: "Workflow-specific parameters",
        required: false
      }
    ]
  }
};
