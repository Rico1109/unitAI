import { z } from "zod";
import type { WorkflowDefinition, ProgressCallback } from "../domain/workflows/types.js";
import { formatWorkflowOutput } from "./utils.js";
import { executeAIClient } from "../services/ai-executor.js";
import { BACKENDS } from "../constants.js";

const refactorSprintSchema = z.object({
  targetFiles: z.array(z.string()).min(1, "Specify at least one file"),
  scope: z.string().min(1, "Describe the refactor scope"),
  depth: z.enum(["light", "balanced", "deep"]).optional().default("balanced"),
  autonomyLevel: z.enum(["read-only", "low", "medium", "high"]).optional(),
  attachments: z.array(z.string()).optional()
});

export type RefactorSprintParams = z.infer<typeof refactorSprintSchema>;

export async function executeRefactorSprint(
  params: RefactorSprintParams,
  onProgress?: ProgressCallback
): Promise<string> {
  const { targetFiles, scope, depth, attachments = [] } = params;

  onProgress?.(`⚙️ Refactor sprint started (${depth}) on ${targetFiles.length} files`);

  let cursorPlan = "";
  try {
    cursorPlan = await executeAIClient({
      backend: BACKENDS.CURSOR,
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
    cursorPlan = `Unable to get plan from Cursor Agent: ${errorMsg}`;
  }

  let geminiReview = "";
  try {
    geminiReview = await executeAIClient({
      backend: BACKENDS.GEMINI,
      prompt: `Evaluate the following refactor plan for ${scope} and report architectural risks.

Target files:
${targetFiles.join(", ")}

Plan:
${cursorPlan}`
    });
  } catch (error) {
    geminiReview = `Unable to get validation from Gemini: ${error instanceof Error ? error.message : String(error)}`;
  }

  let droidChecklist = "";
  try {
    droidChecklist = await executeAIClient({
      backend: BACKENDS.DROID,
      prompt: `Transform this refactoring plan into an operational checklist ready for execution.

Scope: ${scope}
Depth: ${depth}

Reference plan:
${cursorPlan}

Requested checklist:
- Detailed steps
- Suggested commands/tools
- Completion criteria`,
      auto: depth === "deep" ? "medium" : "low",
      outputFormat: "text"
    });
  } catch (error) {
    droidChecklist = `Unable to generate checklist from Droid: ${error instanceof Error ? error.message : String(error)}`;
  }

  const content = `
## Cursor Agent Plan
${cursorPlan}

---

## Gemini Architectural Review
${geminiReview}

---

## Droid Operational Checklist
${droidChecklist}
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

