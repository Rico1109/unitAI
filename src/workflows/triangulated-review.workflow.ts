import { z } from "zod";
import { BACKENDS } from "../constants.js";
import { runParallelAnalysis, buildCodeReviewPrompt, formatWorkflowOutput, formatScorecard, appendRunLog } from "./utils.js";
import type { RunLogEntry } from "./utils.js";
import type { WorkflowDefinition, ProgressCallback } from "../domain/workflows/types.js";
import { executeAIClient } from "../services/ai-executor.js";
import { selectOptimalBackend, createTaskCharacteristics } from "./model-selector.js";
import { getDependencies } from '../dependencies.js';
import { getRoleBackend } from "../config/config.js";

const triangulatedReviewSchema = z.object({
  files: z.array(z.string())
    .min(1, "Specify at least one file to analyze"),
  goal: z.enum(["bugfix", "refactor"])
    .optional()
    .default("refactor"),
  autonomyLevel: z.enum(["read-only", "low", "medium", "high"])
    .optional()
});

export type TriangulatedReviewParams = z.infer<typeof triangulatedReviewSchema>;

export async function executeTriangulatedReview(
  params: TriangulatedReviewParams,
  onProgress?: ProgressCallback
): Promise<string> {
  const { files, goal } = params;
  const workflowStart = Date.now();
  const scorePhases: RunLogEntry['phases'] = [];

  onProgress?.(`🧭 Triangulated review started on ${files.length} files (goal: ${goal})`);

  // Determine configured backends for roles
  const { circuitBreaker } = getDependencies();
  const task = createTaskCharacteristics('triangulated-review', { complexity: 'high' });

  const architectBackend = await selectOptimalBackend(task, circuitBreaker, [getRoleBackend('architect')]);
  const testerBackend = await selectOptimalBackend(task, circuitBreaker, [getRoleBackend('tester')]);
  const implementerBackend = await selectOptimalBackend(task, circuitBreaker, [getRoleBackend('implementer')]);

  // Check for backend convergence (reduced diversity)
  const uniqueBackends = new Set([architectBackend, testerBackend, implementerBackend]);
  if (uniqueBackends.size < 3) {
     onProgress?.(`⚠️ Warning: Multiple roles converged to same backend(s) due to availability/configuration. Diversity reduced. (${[architectBackend, testerBackend, implementerBackend].join(', ')})`);
  }

  const promptBuilder = (backend: string): string => {
    const basePrompt = buildCodeReviewPrompt(files, goal === "bugfix" ? "security" : "quality");

    if (backend === architectBackend) {
      return `${basePrompt}

Focus:
- Architectural alignment
- Long-term impact relative to goal ${goal}`;
    } else if (backend === testerBackend) {
      return `${basePrompt}

Generate concrete refactoring suggestions with priorities and residual risks.`;
    } else {
      return basePrompt;
    }
  };

  const analysisStart = Date.now();
  const analysisResult = await runParallelAnalysis(
    [architectBackend, testerBackend],
    promptBuilder,
    onProgress,
    (backend) => backend === testerBackend
      ? { attachments: files.slice(0, 5), outputFormat: "text", trustedSource: true }
      : { trustedSource: true }  // All internal workflows are trusted
  );

  const analysisMs = Date.now() - analysisStart;
  for (const r of analysisResult.results) {
    scorePhases.push({ name: 'analysis', backend: r.backend, durationMs: analysisMs, success: r.success, error: r.error });
  }

  let verificationResult = "";
  const verifyStart = Date.now();
  try {
    verificationResult = await executeAIClient({
      backend: implementerBackend,
      prompt: `Verify this set of files and generate an operational checklist to complete the goal "${goal}".
File:
${files.join("\n")}

Return:
- Operational steps (max 5)
- Metrics/checks for each step
- Residual risks`,
      auto: "low",
      outputFormat: "text",
      trustedSource: true  // Internal workflow - skip prompt blocking
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    verificationResult = `Unable to execute verification (${implementerBackend}): ${errorMsg}`;
  }
  scorePhases.push({
    name: 'verification',
    backend: implementerBackend,
    durationMs: Date.now() - verifyStart,
    success: !verificationResult.startsWith('Unable to execute')
  });

  const successful = analysisResult.results.filter(r => r.success);
  const failed = analysisResult.results.filter(r => !r.success);

  const content = `
## Analysis Summary (Architect & Tester)
${analysisResult.synthesis}

---

## Autonomous Verification (Implementer)
${verificationResult}

---

## Backend Status
- Successes: ${successful.map(r => r.backend).join(", ") || "None"}
- Failures: ${failed.map(r => `${r.backend} (${r.error})`).join(", ") || "None"}
`;

  const totalMs = Date.now() - workflowStart;
  const scorecardText = formatScorecard(scorePhases, totalMs);
  appendRunLog({
    ts: new Date().toISOString(),
    workflow: 'triangulated-review',
    phases: scorePhases,
    totalDurationMs: totalMs,
    success: successful.length > 0
  });

  return formatWorkflowOutput(
    "Triangulated Review",
    content + '\n\n' + scorecardText,
    {
      files,
      goal,
      backendsUsed: successful.map(r => r.backend),
      failedBackends: failed.map(r => r.backend)
    }
  );
}

export const triangulatedReviewWorkflow: WorkflowDefinition = {
  name: "triangulated-review",
  description: "Compares multiple perspectives (Gemini, Cursor, Droid) for bugfix/refactor of specific files",
  schema: triangulatedReviewSchema,
  execute: executeTriangulatedReview
};

