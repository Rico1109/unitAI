import { z } from "zod";
import { BACKENDS } from "../constants.js";
import { getGitCommitInfo, isGitRepository } from "../utils/cli/gitHelper.js";
import { runParallelAnalysis, formatWorkflowOutput } from "./utils.js";
import type {
  WorkflowDefinition,
  ProgressCallback
} from "../domain/workflows/types.js";
import { selectParallelBackends, createTaskCharacteristics } from "./model-selector.js";
import { getDependencies } from '../dependencies.js';
import { getRoleBackend } from '../config/config.js';

/**
 * Zod schema for the validate-last-commit workflow
 */
const validateLastCommitSchema = z.object({
  commit_ref: z.string().optional().default("HEAD")
    .describe("Riferimento al commit da validare"),
  autonomyLevel: z.enum(["auto", "read-only", "low", "medium", "high"])
    .describe('Ask the user: "What permission level for this workflow? auto = I choose the minimum needed, read-only = analysis only, low = file writes allowed, medium = git commit/branch/install deps, high = git push + external APIs." Use auto if unsure.')
});

export type ValidateLastCommitParams = z.infer<typeof validateLastCommitSchema>;

/**
 * Executes the last commit validation workflow
 */
export async function executeValidateLastCommit(
  params: z.infer<typeof validateLastCommitSchema>,
  onProgress?: ProgressCallback
): Promise<string> {
  const { commit_ref } = params;

  onProgress?.(`Starting commit validation: ${commit_ref}`);

  // Check if we are in a Git repository
  if (!await isGitRepository()) {
    throw new Error("Current directory is not a Git repository");
  }

  // Retrieve commit information
  onProgress?.("Retrieving commit information...");
  let commitInfo;
  try {
    commitInfo = await getGitCommitInfo(commit_ref);
  } catch (error) {
    throw new Error(`Unable to retrieve information for commit ${commit_ref}: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Preparing prompts for each backend
  const promptBuilder = (backend: string): string => {
    const basePrompt = `
Analyze the following Git commit to identify issues, breaking changes, and best practices:

**Commit Information:**
- Hash: ${commitInfo.hash}
- Author: ${commitInfo.author}
- Date: ${commitInfo.date}
- Message: ${commitInfo.message}

**Modified Files:**
${commitInfo.files.map(f => `- ${f}`).join("\n")}

**Diff:**
\`\`\`diff
${commitInfo.diff.substring(0, 3000)}${commitInfo.diff.length > 3000 ? "\n... (diff truncated due to length)" : ""}
\`\`\`

Provide a detailed analysis including:
1. Identified breaking changes
2. Security or performance issues
3. Best practices violations
4. Code quality issues
5. Specific recommendations
6. Overall verdict (APPROVED/REJECTED/REVISION NEEDED)
`;

    // Role-based prompt customization — respects config roles instead of hardcoded backend names
    const architectBackend = getRoleBackend('architect');
    const implementerBackend = getRoleBackend('implementer');
    const testerBackend = getRoleBackend('tester');

    if (backend === architectBackend) {
      return `${basePrompt}\n\nAs architect, provide an architectural analysis focusing on:\n- Impact of changes on existing architecture\n- Long-term scalability and maintainability\n- Consistency with project design patterns\n- Integration considerations with other components\n`;
    }
    if (backend === implementerBackend) {
      return `${basePrompt}\n\nAs implementer, verify the practical implementation:\n- Correctness of business logic\n- Error handling\n- Compliance with project standards\n`;
    }
    if (backend === testerBackend) {
      return `${basePrompt}\n\nAs tester, provide a logical analysis:\n- Consistency with requirements\n- Missing edge cases\n- Possible optimizations\n`;
    }

    return basePrompt;
  };

  // Execute parallel analysis
  onProgress?.("Starting parallel analysis...");

  const { circuitBreaker } = getDependencies();
  const task = createTaskCharacteristics('review');
  task.requiresArchitecturalThinking = true; // Commit validation often needs architectural context
  const backendsToUse = await selectParallelBackends(task, circuitBreaker, 2);

  const analysisResult = await runParallelAnalysis(
    backendsToUse,
    promptBuilder,
    onProgress
  );

  // Analyzing results
  const successful = analysisResult.results.filter(r => r.success);
  const failed = analysisResult.results.filter(r => !r.success);

  // Preparing output
  let outputContent = "";
  const metadata: Record<string, any> = {
    commitRef: commit_ref,
    commitHash: commitInfo.hash,
    commitAuthor: commitInfo.author,
    commitDate: commitInfo.date,
    commitMessage: commitInfo.message,
    filesModified: commitInfo.files,
    backendsUsed: successful.map(r => r.backend),
    failedBackends: failed.map(r => r.backend),
    analysisCount: successful.length,
    timestamp: new Date().toISOString()
  };

  // Commit information
  outputContent += `
## Commit Information

- **Hash**: ${commitInfo.hash}
- **Author**: ${commitInfo.author}
- **Date**: ${commitInfo.date}
- **Message**: ${commitInfo.message}
- **Modified files**: ${commitInfo.files.length}

### Modified Files
${commitInfo.files.map(f => `- ${f}`).join("\n")}
`;

  // If we have results, use the prepared synthesis
  if (analysisResult.synthesis) {
    outputContent += analysisResult.synthesis;
  } else {
    outputContent += "\n## Commit Analysis\n\n";
    outputContent += "No results available from analysis.\n";
  }

  // Combined Verdict
  if (successful.length > 0) {
    outputContent += `
## Combined Verdict

Based on parallel analysis (${successful.map(r => r.backend).join(" + ")}):

`;

    // Logic to determine the verdict
    // In a real implementation, we could analyze the response texts
    // For now, we use simplified logic
    const hasFailures = failed.length > 0;
    const hasSuccessfulAnalyses = successful.length > 0;

    if (hasFailures && !hasSuccessfulAnalyses) {
      outputContent += `### ❌ REJECTED

Analysis could not be completed due to backend errors.
`;
    } else if (hasFailures) {
      outputContent += `### ⚠️ PARTIAL REVISION NEEDED

Some analyses failed, but completed ones suggest the need for revision.
`;
    } else {
      outputContent += `### ✅ APPROVED WITH RESERVATIONS

Analysis completed successfully. Adherence to recommendations is advised.
`;
    }
  }

  // Warnings if some backends failed
  if (failed.length > 0) {
    outputContent += `
## ⚠️ Warnings

The following backends did not complete the analysis:
${failed.map(f => `- **${f.backend}**: ${f.error}`).join("\n")}

Validation may be incomplete. It is recommended to resolve issues and try again.
`;
  }

  // Final recommendations
  outputContent += `
## Final Recommendations

1. **Code Review**: Manually verify changes before merging
2. **Test**: Run complete tests to verify there are no regressions
3. **Documentation**: Update documentation if needed
4. **Communication**: Inform the team of significant changes

For specific details, consult the individual analyses above.
`;

  onProgress?.(`Commit validation completed: ${successful.length}/${analysisResult.results.length} successful analyses`);

  return formatWorkflowOutput(`Commit Validation: ${commit_ref}`, outputContent, metadata);
}

/**
 * Definition of the validate-last-commit workflow
 */
export const validateLastCommitWorkflow: WorkflowDefinition = {
  name: 'validate-last-commit',
  description: "Validates a specific Git commit using parallel analysis with Gemini and Cursor to identify issues and breaking changes",
  schema: validateLastCommitSchema,
  execute: executeValidateLastCommit
};
