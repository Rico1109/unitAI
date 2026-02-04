import { z } from "zod";
import { BACKENDS } from "../constants.js";
import { runParallelAnalysis, buildCodeReviewPrompt, formatWorkflowOutput } from "./utils.js";
import { generateWorkflowId, structuredLogger } from "../services/structured-logger.js";
import type {
  WorkflowDefinition,
  ProgressCallback,
  ParallelReviewParams,
  ReviewFocus
} from "../domain/workflows/types.js";
import { selectParallelBackends, createTaskCharacteristics } from "./model-selector.js";
import { getDependencies } from '../dependencies.js';

/**
 * Zod Schema for parallel-review workflow
 */
const parallelReviewSchema = z.object({
  files: z.array(z.string()).describe("Files to analyze"),
  focus: z.enum(["architecture", "security", "performance", "quality", "all"])
    .optional().default("all").describe("Analysis focus area"),
  autonomyLevel: z.enum(["read-only", "low", "medium", "high"])
    .optional().describe("Autonomy level for workflow operations (default: read-only)"),
  strategy: z.enum(["standard", "double-check"])
    .optional()
    .default("standard")
    .describe("Review strategy (double-check adds Cursor + Droid)"),
  backendOverrides: z.array(z.string())
    .optional()
    .describe("Explicit override of backends to use"),
  attachments: z.array(z.string())
    .optional()
    .describe("Files to attach to analysis (passed to Cursor/Droid)")
});

/**
 * Executes the parallel review workflow
 */
export async function executeParallelReview(
  params: z.infer<typeof parallelReviewSchema>,
  onProgress?: ProgressCallback
): Promise<string> {
  const { files, focus, strategy = "standard", backendOverrides, attachments = [] } = params;

  // Setup structured logging
  const workflowId = generateWorkflowId();
  const logger = structuredLogger.forWorkflow(workflowId, 'parallel-review');

  logger.step('start', 'Starting parallel review workflow', {
    filesCount: files.length,
    focus,
    autonomyLevel: params.autonomyLevel
  });

  onProgress?.(`Starting parallel review of ${files.length} files with focus: ${focus}`);

  // File validation
  if (files.length === 0) {
    logger.error('validation-failed', new Error('No files specified'));
    throw new Error("Must specify at least one file to analyze");
  }

  logger.step('validation', 'File validation passed', { filesCount: files.length });

  // Preparing prompts for each backend
  const promptBuilder = (backend: string): string => {
    const basePrompt = buildCodeReviewPrompt(files, focus as ReviewFocus);

    // Customization for specific backends
    switch (backend) {
      case BACKENDS.GEMINI:
        return `${basePrompt}

As Gemini, provide an in-depth analysis with particular attention to:
- Architettura e design patterns
- Long-term impact of changes
- Scalability considerations
- Software engineering best practices
`;


      case BACKENDS.CURSOR:
        return `${basePrompt}

As Cursor Agent, generate a detailed refactoring plan:
- Highlight medium-term technical risks
- Suggest surgical patches with minimal context
- Prioritize interventions based on impact
- Propose tests to add
`;
      case BACKENDS.DROID:
        return `${basePrompt}

As Factory Droid, act as an autonomous verifier:
- Evaluate if previous suggestions are sufficient
- Identify any operational gaps
- Design a multi-step remediation plan
- List final validation checklists
`;

      case BACKENDS.ROVODEV:
        return `${basePrompt}

As Rovo Dev, act as a practical implementer:
- Provide ready-to-use code snippets
- Identify missing dependencies
- Suggest immediate improvements
`;

      case BACKENDS.QWEN:
        return `${basePrompt}

As Qwen, provide a logical and structured analysis:
- Verify code consistency
- Identify unhandled edge cases
- Suggest algorithmic optimizations
`;

      default:
        return basePrompt;
    }
  };

  // Executing parallel analysis
  let backendsToUse: string[] = [];

  if (backendOverrides && backendOverrides.length > 0) {
    backendsToUse = backendOverrides;
  } else {
    // Dynamic selection
    const { circuitBreaker } = getDependencies();
    const task = createTaskCharacteristics('review');
    // Map focus to task characteristics
    if (focus === 'architecture') task.requiresArchitecturalThinking = true;
    if (focus === 'security') task.domain = 'security';

    const count = strategy === "double-check" ? 3 : 2;
    backendsToUse = await selectParallelBackends(task, circuitBreaker, count);
  }

  logger.step('parallel-analysis-start', 'Starting parallel analysis', {
    backends: backendsToUse
  });

  onProgress?.(`Starting analysis with backends: ${backendsToUse.join(\", \")}`);

  const analysisResult = await logger.timing('parallel-analysis', async () => {
    return await runParallelAnalysis(
      backendsToUse,
      promptBuilder,
      onProgress,
      (backend) => {
        if (backend === BACKENDS.CURSOR) {
          return {
            attachments,
            outputFormat: "text",
            autoApprove: strategy === "double-check" // Maps to --force flag
          };
        }
        if (backend === BACKENDS.DROID) {
          return {
            attachments,
            auto: strategy === "double-check" ? "medium" : "low",
            outputFormat: "text"
          };
        }
        if (backend === BACKENDS.ROVODEV) {
          return {
            autoApprove: strategy === "double-check" // Maps to --yolo
          };
        }
        if (backend === BACKENDS.QWEN) {
          return {
            outputFormat: "text",
            autoApprove: strategy === "double-check" // Maps to -y
          };
        }
        return {};
      }
    );
  });

  // Analyzing results
  const successful = analysisResult.results.filter(r => r.success);
  const failed = analysisResult.results.filter(r => !r.success);

  // Preparing output
  let outputContent = "";
  const metadata: Record<string, any> = {
    filesAnalyzed: files,
    focus,
    backendsUsed: successful.map(r => r.backend),
    failedBackends: failed.map(r => r.backend),
    analysisCount: successful.length,
    timestamp: new Date().toISOString(),
    strategy,
    attachments
  };

  // If we have results, use the prepared synthesis
  if (analysisResult.synthesis) {
    outputContent = analysisResult.synthesis;
  } else {
    outputContent = "# Parallel Code Analysis\n\n";
    outputContent += "No results available from analysis.\n";
  }

  // Adding summary section
  outputContent += `
## Analysis Summary

- **Files analyzed**: ${files.join(", ")}
- **Focus**: ${focus}
- **Backends used**: ${successful.map(r => r.backend).join(", ") || "None"}
- **Outcome**: ${successful.length > 0 ? "✅ Completed" : "❌ Failed"}
`;

  // Adding combined recommendations if available
  if (successful.length > 0) {
    outputContent += `
## Combined Recommendations

Based on parallel analysis, here are the key recommendations:

1. **High Priority**: Pay attention to identified security and performance issues
2. **Medium Priority**: Consider refactoring suggestions to improve maintainability
3. **Low Priority**: Evaluate architectural recommendations for the long term

For specific details, consult the individual analyses above.
`;
  }

  // Warnings if some backends failed
  if (failed.length > 0) {
    outputContent += `
## ⚠️ Warnings

The following backends did not complete the analysis:
${failed.map(f => `- **${f.backend}**: ${f.error}`).join("\n")}

The analysis may be incomplete. It is recommended to resolve the issues and try again.
`;
  }

  onProgress?.(`Parallel review completed: ${successful.length}/${analysisResult.results.length} successful analyses`);

  logger.step('complete', 'Parallel review completed successfully', {
    successfulAnalyses: successful.length,
    failedAnalyses: failed.length,
    totalBackends: analysisResult.results.length
  });

  return formatWorkflowOutput("Parallel Code Review", outputContent, metadata);
}

/**
 * Definition of parallel-review workflow
 */
export const parallelReviewWorkflow: WorkflowDefinition = {
  name: 'parallel-review',
  description: "Executes a parallel code analysis using Gemini, Cursor and Droid to provide a complete and multi-perspective review",
  schema: parallelReviewSchema,
  execute: executeParallelReview
};
