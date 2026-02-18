import { z } from "zod";
import type { WorkflowDefinition, ProgressCallback } from "../domain/workflows/types.js";
import { formatWorkflowOutput } from "./utils.js";
import { executeAIClient } from "../services/ai-executor.js";
import { getRoleBackend } from "../config/config.js";
import { getDependencies } from '../dependencies.js';
import { selectParallelBackends, createTaskCharacteristics } from './model-selector.js';
import { AutonomyLevel } from '../utils/security/permissionManager.js';

const refactorSprintSchema = z.object({
  targetFiles: z.array(z.string()).min(1, "Specify at least one file"),
  scope: z.string().min(1, "Describe the refactor scope"),
  depth: z.enum(["light", "balanced", "deep"]).optional().default("balanced"),
  autonomyLevel: z.nativeEnum(AutonomyLevel).optional(),
  attachments: z.array(z.string()).optional()
});

export type RefactorSprintParams = z.infer<typeof refactorSprintSchema>;

export async function executeRefactorSprint(
  params: RefactorSprintParams,
  onProgress?: ProgressCallback
): Promise<string> {
  const { targetFiles, scope, depth, attachments = [] } = params;

  const { circuitBreaker } = getDependencies();
  const task = createTaskCharacteristics('refactor-sprint');
  const selectedBackends = await selectParallelBackends(task, circuitBreaker, 3);

  const implementerBackend = selectedBackends[0] ?? getRoleBackend('implementer');
  const architectBackend   = selectedBackends[1] ?? getRoleBackend('architect');
  const testerBackend      = selectedBackends[2] ?? getRoleBackend('tester');

  onProgress?.(`⚙️ Refactor sprint started (${depth}) on ${targetFiles.length} files`);

  let implementerPlan = "";
  try {
    implementerPlan = await executeAIClient({
      backend: implementerBackend,
      prompt: `You are planning a refactor (${depth}). Scope: ${scope}.

Target files:
${targetFiles.join("\n")}

Generate:
- Numbered step plan
- Suggested patches (can be descriptive)
- Recommended tests`,
      attachments: attachments.length ? attachments : targetFiles.slice(0, 5),
      outputFormat: "text"
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    implementerPlan = `Unable to get plan from implementer: ${errorMsg}`;
  }

  let architectReview = "";
  try {
    architectReview = await executeAIClient({
      backend: architectBackend,
      prompt: `Evaluate the following refactor plan for ${scope} and report architectural risks.

Target files:
${targetFiles.join(", ")}

Plan:
${implementerPlan}`
    });
  } catch (error) {
    architectReview = `Unable to get validation from architect: ${error instanceof Error ? error.message : String(error)}`;
  }

  let testerChecklist = "";
  try {
    testerChecklist = await executeAIClient({
      backend: testerBackend,
      prompt: `Transform this refactoring plan into an operational checklist ready for execution.

Scope: ${scope}
Depth: ${depth}

Reference plan:
${implementerPlan}

Requested checklist:
- Detailed steps
- Suggested commands/tools
- Completion criteria`,
      auto: depth === "deep" ? "medium" : "low",
      outputFormat: "text"
    });
  } catch (error) {
    testerChecklist = `Unable to generate checklist from tester: ${error instanceof Error ? error.message : String(error)}`;
  }

  const content = `
## Implementer Plan
${implementerPlan}

---

## Architect Review
${architectReview}

---

## Tester Checklist
${testerChecklist}
`;

  return formatWorkflowOutput(
    "Refactor Sprint",
    content,
    {
      targetFiles,
      scope,
      depth
    }
  );
}

export const refactorSprintWorkflow: WorkflowDefinition = {
  name: "refactor-sprint",
  description: "Coordinates Cursor, Gemini, and Droid to plan a multi-step refactor",
  schema: refactorSprintSchema,
  execute: executeRefactorSprint
};

