import { z } from "zod";
import { BACKENDS } from "../constants.js";
import { runParallelAnalysis, buildCodeReviewPrompt, formatWorkflowOutput } from "./utils.js";
import type { WorkflowDefinition, ProgressCallback } from "../domain/workflows/types.js";
import { executeAIClient } from "../services/ai-executor.js";
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

  onProgress?.(`🧭 Triangulated review started on ${files.length} files (goal: ${goal})`);

  // Determine configured backends for roles
  const architectBackend = getRoleBackend('architect');   // Was Gemini
  const testerBackend = getRoleBackend('tester');         // Was Cursor
  const implementerBackend = getRoleBackend('implementer'); // Was Droid

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

  const analysisResult = await runParallelAnalysis(
    [architectBackend, testerBackend],
    promptBuilder,
    onProgress,
    (backend) => backend === testerBackend
      ? { attachments: files.slice(0, 5), outputFormat: "text", trustedSource: true }
      : { trustedSource: true }  // All internal workflows are trusted
  );

  let verificationResult = "";
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

  return formatWorkflowOutput(
    "Triangulated Review",
    content,
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

