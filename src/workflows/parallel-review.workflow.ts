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
 * Schema Zod per il workflow parallel-review
 */
const parallelReviewSchema = z.object({
  files: z.array(z.string()).describe("File da analizzare"),
  focus: z.enum(["architecture", "security", "performance", "quality", "all"])
    .optional().default("all").describe("Area di focus dell'analisi"),
  autonomyLevel: z.enum(["read-only", "low", "medium", "high"])
    .optional().describe("Livello di autonomia per le operazioni del workflow (default: read-only)"),
  strategy: z.enum(["standard", "double-check"])
    .optional()
    .default("standard")
    .describe("Strategia di revisione (double-check aggiunge Cursor + Droid)"),
  backendOverrides: z.array(z.string())
    .optional()
    .describe("Override esplicito dei backend da utilizzare"),
  attachments: z.array(z.string())
    .optional()
    .describe("File da allegare alle analisi (passati a Cursor/Droid)")
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

  onProgress?.(`Avvio revisione parallela di ${files.length} file con focus: ${focus}`);

  // Validazione dei file
  if (files.length === 0) {
    logger.error('validation-failed', new Error('No files specified'));
    throw new Error("È necessario specificare almeno un file da analizzare");
  }

  logger.step('validation', 'File validation passed', { filesCount: files.length });

  // Preparazione dei prompt per ogni backend
  const promptBuilder = (backend: string): string => {
    const basePrompt = buildCodeReviewPrompt(files, focus as ReviewFocus);

    // Personalizzazione per backend specifici
    switch (backend) {
      case BACKENDS.GEMINI:
        return `${basePrompt}

Come Gemini, fornisci un'analisi approfondita con particolare attenzione a:
- Architettura e design patterns
- Long-term impact of changes
- Considerazioni sulla scalabilità
- Best practices di ingegneria del software
`;


      case BACKENDS.CURSOR:
        return `${basePrompt}

Come Cursor Agent, genera un piano di refactoring dettagliato:
- Evidenzia rischi tecnici a medio termine
- Suggerisci patch chirurgiche con contesto minimo
- Prioritizza interventi in base all'impatto
- Proponi test da aggiungere
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

Come Rovo Dev, agisci come implementatore pratico:
- Fornisci snippet di codice pronti all'uso
- Identifica dipendenze mancanti
- Suggerisci miglioramenti immediati
`;

      case BACKENDS.QWEN:
        return `${basePrompt}

Come Qwen, fornisci un'analisi logica e strutturata:
- Verify code consistency
- Identify unhandled edge cases
- Suggest algorithmic optimizations
`;

      default:
        return basePrompt;
    }
  };

  // Esecuzione dell'analisi parallela
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

  onProgress?.(`Avvio analisi con i backend: ${backendsToUse.join(", ")}`);

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

  // Analisi dei risultati
  const successful = analysisResult.results.filter(r => r.success);
  const failed = analysisResult.results.filter(r => !r.success);

  // Preparazione dell'output
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

  // Se abbiamo risultati, usiamo la sintesi già preparata
  if (analysisResult.synthesis) {
    outputContent = analysisResult.synthesis;
  } else {
    outputContent = "# Analisi Parallela del Codice\n\n";
    outputContent += "Nessun risultato disponibile dall'analisi.\n";
  }

  // Aggiunta di una sezione di riepilogo
  outputContent += `
## Riepilogo Analisi

- **File analizzati**: ${files.join(", ")}
- **Focus**: ${focus}
- **Backend utilizzati**: ${successful.map(r => r.backend).join(", ") || "Nessuno"}
- **Esito**: ${successful.length > 0 ? "✅ Completata" : "❌ Fallita"}
`;

  // Aggiunta di raccomandazioni combinate se disponibili
  if (successful.length > 0) {
    outputContent += `
## Raccomandazioni Combinate

Basandosi sull'analisi parallela, ecco le raccomandazioni principali:

1. **Priorità Alta**: Presta attenzione ai problemi di sicurezza e performance identificati
2. **Priorità Media**: Considera i suggerimenti di refactoring per migliorare la manutenibilità
3. **Priorità Bassa**: Valuta le raccomandazioni architetturali per il lungo termine

Per dettagli specifici, consulta le analisi individuali sopra.
`;
  }

  // Avvisi se alcuni backend sono falliti
  if (failed.length > 0) {
    outputContent += `
## ⚠️ Avvisi

I seguenti backend non hanno completato l'analisi:
${failed.map(f => `- **${f.backend}**: ${f.error}`).join("\n")}

L'analisi potrebbe essere incompleta. Si consiglia di risolvere i problemi e riprovare.
`;
  }

  onProgress?.(`Revisione parallela completata: ${successful.length}/${analysisResult.results.length} analisi riuscite`);

  logger.step('complete', 'Parallel review completed successfully', {
    successfulAnalyses: successful.length,
    failedAnalyses: failed.length,
    totalBackends: analysisResult.results.length
  });

  return formatWorkflowOutput("Revisione Parallela del Codice (Parallel Review)", outputContent, metadata);
}

/**
 * Definizione del workflow parallel-review
 */
export const parallelReviewWorkflow: WorkflowDefinition = {
  name: 'parallel-review',
  description: "Executes a parallel code analysis using Gemini, Cursor and Droid to provide a complete and multi-perspective review",
  schema: parallelReviewSchema,
  execute: executeParallelReview
};
