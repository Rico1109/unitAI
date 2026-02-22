import { z } from "zod";
import type { WorkflowDefinition, ProgressCallback } from "../domain/workflows/types.js";
import { formatWorkflowOutput } from "./utils.js";
import { executeAIClient } from "../services/ai-executor.js";
import { getRoleBackend } from "../config/config.js";
import { getDependencies } from '../dependencies.js';
import { selectOptimalBackend, createTaskCharacteristics } from './model-selector.js';
import { AutonomyLevel, OperationType, assertPermission } from '../utils/security/permissionManager.js';
import { sanitizeUserInput } from '../utils/security/inputSanitizer.js';

const autoRemediationSchema = z.object({
  symptoms: z.string().min(1, "Describe the problem symptoms"),
  maxActions: z.number().int().min(1).max(10).optional().default(5),
  autonomyLevel: z.enum(["auto", "read-only", "low", "medium", "high"])
    .describe('Ask the user: "What permission level for this workflow? auto = I choose the minimum needed, read-only = analysis only, low = file writes allowed, medium = git commit/branch/install deps, high = git push + external APIs." Use auto if unsure.'),
  attachments: z.array(z.string()).optional()
});

export type AutoRemediationParams = z.infer<typeof autoRemediationSchema>;

export async function executeAutoRemediation(
  params: AutoRemediationParams,
  onProgress?: ProgressCallback
): Promise<string> {
  const { symptoms: rawSymptoms, maxActions, attachments = [] } = params;
  const symptoms = sanitizeUserInput(rawSymptoms);

  // autonomyLevel is always a concrete AutonomyLevel here (registry resolves "auto")
  const level = (params.autonomyLevel as AutonomyLevel) ?? AutonomyLevel.MEDIUM;
  assertPermission(level, OperationType.WRITE_FILE, 'this workflow may write files via AI agents');

  onProgress?.("🛠️ Generating auto-remediation plan...");

  const { circuitBreaker } = getDependencies();
  const task = createTaskCharacteristics('auto-remediation');
  const backend = await selectOptimalBackend(task, circuitBreaker);

  let plan = "";
  try {
    plan = await executeAIClient({
      backend,
      prompt: `Symptoms: ${symptoms}

Generate an operational plan in maximum ${maxActions} steps.
For each step provide:
- Proposed action
- Expected output
- Checks/verifications
- Residual risks`,
      autonomyLevel: level,
      attachments,
      outputFormat: "text"
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    plan = `Unable to generate remediation plan: ${errorMsg}`;
  }

  const content = `
## Symptoms
${symptoms}

---

## Autonomous Remediation Plan
${plan}
`;

  return formatWorkflowOutput(
    "Auto Remediation Plan",
    content,
    {
      maxActions,
      attachments
    }
  );
}

export const autoRemediationWorkflow: WorkflowDefinition = {
  name: "auto-remediation",
  description: "Generates an automatic remediation plan using Factory Droid",
  schema: autoRemediationSchema,
  execute: executeAutoRemediation
};

