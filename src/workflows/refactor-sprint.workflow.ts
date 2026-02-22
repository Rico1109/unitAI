import { z } from "zod";
import type { WorkflowDefinition, ProgressCallback } from "../domain/workflows/types.js";
import { formatWorkflowOutput, formatScorecard, appendRunLog } from "./utils.js";
import type { RunLogEntry } from "./utils.js";
import { executeAIClient } from "../services/ai-executor.js";
import { getRoleBackend } from "../config/config.js";
import { getDependencies } from '../dependencies.js';
import { selectParallelBackends, createTaskCharacteristics } from './model-selector.js';
import { AutonomyLevel, OperationType, assertPermission } from '../utils/security/permissionManager.js';

const refactorSprintSchema = z.object({
  targetFiles: z.array(z.string()).min(1, "Specify at least one file"),
  scope: z.string().min(1, "Describe the refactor scope"),
  depth: z.enum(["light", "balanced", "deep"]).optional().default("balanced"),
  autonomyLevel: z.enum(["auto", "read-only", "low", "medium", "high"])
    .describe('Ask the user: "What permission level for this workflow? auto = I choose the minimum needed, read-only = analysis only, low = file writes allowed, medium = git commit/branch/install deps, high = git push + external APIs." Use auto if unsure.'),
  attachments: z.array(z.string()).optional()
});

export type RefactorSprintParams = z.infer<typeof refactorSprintSchema>;

export async function executeRefactorSprint(
  params: RefactorSprintParams,
  onProgress?: ProgressCallback
): Promise<string> {
  const { targetFiles, scope, depth, attachments = [] } = params;
  const workflowStart = Date.now();
  const scorePhases: RunLogEntry['phases'] = [];

  // autonomyLevel is always a concrete AutonomyLevel here (registry resolves "auto")
  const level = (params.autonomyLevel as AutonomyLevel) ?? AutonomyLevel.MEDIUM;
  assertPermission(level, OperationType.WRITE_FILE, 'this workflow may write files via AI agents');

  const { circuitBreaker } = getDependencies();
  const task = createTaskCharacteristics('refactor-sprint');
  const selectedBackends = await selectParallelBackends(task, circuitBreaker, 3);

  const implementerBackend = selectedBackends[0] ?? getRoleBackend('implementer');
  const architectBackend   = selectedBackends[1] ?? getRoleBackend('architect');
  const testerBackend      = selectedBackends[2] ?? getRoleBackend('tester');

  onProgress?.(`⚙️ Refactor sprint started (${depth}) on ${targetFiles.length} files`);

  let implementerPlan = "";
  const implStart = Date.now();
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
  scorePhases.push({ name: 'plan', backend: implementerBackend, durationMs: Date.now() - implStart, success: !implementerPlan.startsWith('Unable') });

  let architectReview = "";
  const archStart = Date.now();
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
  scorePhases.push({ name: 'review', backend: architectBackend, durationMs: Date.now() - archStart, success: !architectReview.startsWith('Unable') });

  let testerChecklist = "";
  const testerStart = Date.now();
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
      autonomyLevel: level,
      outputFormat: "text"
    });
  } catch (error) {
    testerChecklist = `Unable to generate checklist from tester: ${error instanceof Error ? error.message : String(error)}`;
  }
  scorePhases.push({ name: 'checklist', backend: testerBackend, durationMs: Date.now() - testerStart, success: !testerChecklist.startsWith('Unable') });

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

  const totalMs = Date.now() - workflowStart;
  appendRunLog({
    ts: new Date().toISOString(),
    workflow: 'refactor-sprint',
    phases: scorePhases,
    totalDurationMs: totalMs,
    success: scorePhases.every(p => p.success)
  });

  return formatWorkflowOutput(
    "Refactor Sprint",
    content + '\n\n' + formatScorecard(scorePhases, totalMs),
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

