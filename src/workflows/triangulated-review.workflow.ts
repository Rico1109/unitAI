import { z } from "zod";
import { BACKENDS } from "../constants.js";
import { runParallelAnalysis, buildCodeReviewPrompt, formatWorkflowOutput } from "./utils.js";
import type { WorkflowDefinition, ProgressCallback } from "../domain/workflows/types.js";
import { executeAIClient } from "../services/ai-executor.js";

const triangulatedReviewSchema = z.object({
  files: z.array(z.string())
    .min(1, "Specificare almeno un file da analizzare"),
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

  onProgress?.(`🧭 Triangulated review avviata su ${files.length} file (goal: ${goal})`);

  const promptBuilder = (backend: string): string => {
    const basePrompt = buildCodeReviewPrompt(files, goal === "bugfix" ? "security" : "quality");

    switch (backend) {
      case BACKENDS.GEMINI:
        return `${basePrompt}

Focus:
- Allineamento architetturale
- Impatto a lungo termine rispetto all'obiettivo ${goal}`;
      case BACKENDS.CURSOR:
        return `${basePrompt}

Genera suggerimenti concreti di refactoring con priorità e rischi residui.`;
      default:
        return basePrompt;
    }
  };

  const analysisResult = await runParallelAnalysis(
    [BACKENDS.GEMINI, BACKENDS.CURSOR],
    promptBuilder,
    onProgress,
    (backend) => backend === BACKENDS.CURSOR
      ? { attachments: files.slice(0, 5), outputFormat: "text", trustedSource: true }
      : { trustedSource: true }  // All internal workflows are trusted
  );

  let droidVerification = "";
  try {
    droidVerification = await executeAIClient({
      backend: BACKENDS.DROID,
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
    droidVerification = `Unable to execute Droid: ${errorMsg}`;
  }

  const successful = analysisResult.results.filter(r => r.success);
  const failed = analysisResult.results.filter(r => !r.success);

  const content = `
## Analysis Summary (Gemini + Cursor)
${analysisResult.synthesis}

---

## Autonomous Verification (Droid)
${droidVerification}

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
  description: "Confronta prospettive multiple (Gemini, Cursor, Droid) per bugfix/refactor di file specifici",
  schema: triangulatedReviewSchema,
  execute: executeTriangulatedReview
};

