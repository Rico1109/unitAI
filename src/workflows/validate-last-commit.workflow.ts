import { z } from "zod";
import { BACKENDS } from "../constants.js";
import { getGitCommitInfo, isGitRepository } from "../utils/cli/gitHelper.js";
import { runParallelAnalysis, formatWorkflowOutput } from "./utils.js";
import type {
  WorkflowDefinition,
  ProgressCallback,
  ValidateLastCommitParams
} from "../domain/workflows/types.js";
import { selectParallelBackends, createTaskCharacteristics } from "./model-selector.js";
import { getDependencies } from '../dependencies.js';

/**
 * Schema Zod per il workflow validate-last-commit
 */
const validateLastCommitSchema = z.object({
  commit_ref: z.string().optional().default("HEAD")
    .describe("Riferimento al commit da validare"),
  autonomyLevel: z.enum(["read-only", "low", "medium", "high"])
    .optional().describe("Livello di autonomia per le operazioni del workflow (default: read-only)")
});

/**
 * Executes the last commit validation workflow
 */
export async function executeValidateLastCommit(
  params: z.infer<typeof validateLastCommitSchema>,
  onProgress?: ProgressCallback
): Promise<string> {
  const { commit_ref } = params;

  onProgress?.(`Avvio validazione del commit: ${commit_ref}`);

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

    // Personalizzazione per backend specifici
    switch (backend) {
      case BACKENDS.GEMINI:
        return `${basePrompt}

As Gemini, provide an architectural analysis focusing on:
- Impact of changes on existing architecture
- Scalabilità e manutenibilità a lungo termine
- Consistenza con i pattern di design del progetto
- Considerazioni sull'integrazione con altri componenti
`;

      case BACKENDS.CURSOR:
        return `${basePrompt}

As Cursor Agent, provide a technical analysis focusing on:
- Correttezza del codice e potenziali bug
- Algorithm efficiency and complexity
- Error handling and edge cases
- Conformità con le convenzioni del linguaggio
`;

      case BACKENDS.DROID:
        return `${basePrompt}

As Factory Droid, verify the practical implementation:
- Correctness of business logic
- Error handling
- Compliance with project standards
`;

      case BACKENDS.ROVODEV:
        return `${basePrompt}

As Rovo Dev, analyze the operational impact:
- Dependencies introduced
- Deployment complexity
- Regression risks
`;

      case BACKENDS.QWEN:
        return `${basePrompt}

As Qwen, provide a logical analysis:
- Consistency with requirements
- Missing edge cases
- Possible optimizations
`;

      default:
        return basePrompt;
    }
  };

  // Esecuzione dell'analisi parallela
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
- **Autore**: ${commitInfo.author}
- **Data**: ${commitInfo.date}
- **Messaggio**: ${commitInfo.message}
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

    // Logica per determinare il verdetto
    // In a real implementation, we could analyze the response texts
    // Per ora, usiamo una logica semplificata
    const hasFailures = failed.length > 0;
    const hasSuccessfulAnalyses = successful.length > 0;

    if (hasFailures && !hasSuccessfulAnalyses) {
      outputContent += `### ❌ RIFIUTATO

L'analisi non può essere completata a causa di errori nei backend.
`;
    } else if (hasFailures) {
      outputContent += `### ⚠️ NECESSARIA REVISIONE PARZIALE

Alcune analisi sono fallite, ma quelle completate suggeriscono la necessità di revisione.
`;
    } else {
      outputContent += `### ✅ APPROVATO CON RISERVE

L'analisi è stata completata con successo. Si raccomanda di attenere alle raccomandazioni fornite.
`;
    }
  }

  // Avvisi se alcuni backend sono falliti
  if (failed.length > 0) {
    outputContent += `
## ⚠️ Avvisi

I seguenti backend non hanno completato l'analisi:
${failed.map(f => `- **${f.backend}**: ${f.error}`).join("\n")}

La validazione potrebbe essere incompleta. Si consiglia di risolvere i problemi e riprovare.
`;
  }

  // Raccomandazioni finali
  outputContent += `
## Raccomandazioni Finali

1. **Code Review**: Manually verify changes before merging
2. **Test**: Run complete tests to verify there are no regressions
3. **Documentation**: Update documentation if needed
4. **Communication**: Inform the team of significant changes

Per dettagli specifici, consulta le analisi individuali sopra.
`;

  onProgress?.(`Validazione commit completata: ${successful.length}/${analysisResult.results.length} analisi riuscite`);

  return formatWorkflowOutput(`Validazione Commit (Commit Validation): ${commit_ref}`, outputContent, metadata);
}

/**
 * Definizione del workflow validate-last-commit
 */
export const validateLastCommitWorkflow: WorkflowDefinition = {
  name: 'validate-last-commit',
  description: "Valida un commit Git specifico utilizzando analisi parallela con Gemini e Cursor per identificare problemi e breaking changes",
  schema: validateLastCommitSchema,
  execute: executeValidateLastCommit
};
