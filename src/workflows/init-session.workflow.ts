import { z } from "zod";
import { getGitRepoInfo, getGitDiff, getDetailedGitStatus, getGitBranches, checkCLIAvailability, isGitRepository, getRecentCommitsWithDiffs, getDateRangeFromCommits } from "../utils/gitHelper.js";
import { formatWorkflowOutput } from "./utils.js";
import { executeAIClient } from "../utils/aiExecutor.js";
import { BACKENDS } from "../constants.js";
import type { WorkflowDefinition, ProgressCallback, GitCommitInfo } from "./types.js";

/**
 * Schema Zod per il workflow init-session
 */
const initSessionSchema = z.object({});

/**
 * Costruisce il prompt per l'analisi AI dei commit
 */
function buildCommitAnalysisPrompt(commits: GitCommitInfo[]): string {
  let prompt = `Analyze the following ${commits.length} recent commits and provide a concise summary of the work done.

Focus on:
1. **Feature changes**: What new features or functionality was added
2. **Bug fixes**: What bugs were fixed and their root causes
3. **Refactoring/architecture**: Structural changes, code organization improvements
4. **Current work status**: What's in progress, what's completed, what might be next

Format your response as a clear, actionable summary that points to specific files and changes.

---

# Commits to Analyze

`;

  commits.forEach((commit, index) => {
    prompt += `
## Commit ${index + 1}: ${commit.message}
- **Author**: ${commit.author}
- **Date**: ${commit.date}
- **Hash**: ${commit.hash.substring(0, 8)}
- **Files**: ${commit.files.join(", ")}

### Diff (truncated to first 3000 chars):
\`\`\`diff
${commit.diff.substring(0, 3000)}${commit.diff.length > 3000 ? "\n... (diff truncated)" : ""}
\`\`\`

---
`;
  });

  prompt += `
Please provide a synthesized analysis of these commits.`;

  return prompt;
}

/**
 * Esegue il workflow di inizializzazione sessione
 */
async function executeInitSession(
  params: z.infer<typeof initSessionSchema>,
  onProgress?: ProgressCallback
): Promise<string> {
  onProgress?.("Avvio inizializzazione sessione...");

  const sections: string[] = [];
  const metadata: Record<string, any> = {};

  // Verifica se siamo in un repository Git
  const isRepo = await isGitRepository();
  metadata.isGitRepository = isRepo;

  if (isRepo) {
    onProgress?.("Recupero informazioni repository Git...");

    try {
      // Informazioni base del repository
      const repoInfo = await getGitRepoInfo();
      sections.push(`
## Informazioni Repository

- **Branch corrente**: ${repoInfo.currentBranch}
- **File staged**: ${repoInfo.stagedFiles.length}
- **File modificati**: ${repoInfo.modifiedFiles.length}
`);

      // Ottieni gli ultimi 10 commits con diffs completi
      onProgress?.("Recupero ultimi 10 commits con diffs...");
      const recentCommits = await getRecentCommitsWithDiffs(10);
      metadata.commitsAnalyzed = recentCommits.length;

      // Commit recenti (sommario)
      sections.push(`
## Commit Recenti (ultimi 10)

${recentCommits.map((commit, i) => `${i + 1}. [${commit.hash.substring(0, 8)}] ${commit.message} - ${commit.author}`).join("\n")}
`);

      // Analisi AI con Rovodev
      onProgress?.("Analisi AI dei commit con Rovodev...");
      let aiAnalysis = "";
      try {
        const analysisPrompt = buildCommitAnalysisPrompt(recentCommits);
        aiAnalysis = await executeAIClient({
          backend: BACKENDS.ROVODEV,
          prompt: analysisPrompt
        });

        sections.push(`
## AI Analysis of Recent Work

${aiAnalysis}
`);
        metadata.aiAnalysisCompleted = true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        sections.push(`
## AI Analysis

⚠️ Could not complete AI analysis: ${errorMsg}
`);
        metadata.aiAnalysisCompleted = false;
      }

      // Ricerca memorie basata sul range di date
      onProgress?.("Ricerca memorie correlate...");
      const dateRange = getDateRangeFromCommits(recentCommits);
      if (dateRange) {
        metadata.dateRange = dateRange;

        // Costruisci query per openmemory
        const memoryQuery = `memories from ${dateRange.oldest} to ${dateRange.newest}`;

        // Nota: MCP tools non possono essere chiamati direttamente da un workflow
        // L'utente dovrà cercare manualmente le memorie usando il comando suggerito
        sections.push(`
## Relevant Memories

📅 Date range: ${dateRange.oldest} to ${dateRange.newest}

*Note: To search memories for this period, run:*
\`\`\`
mcp__openmemory__search-memories "${memoryQuery}"
\`\`\`
`);
      }

      // Status dettagliato
      onProgress?.("Recupero stato repository...");
      const status = await getDetailedGitStatus();
      sections.push(`
## Stato Repository

\`\`\`
${status}
\`\`\`
`);

      // Informazioni sui branch
      onProgress?.("Recupero informazioni branch...");
      const branches = await getGitBranches();
      sections.push(`
## Branch

\`\`\`
${branches}
\`\`\`
`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      sections.push(`
## Errore nel recupero informazioni Git

${errorMsg}
`);
    }
  } else {
    sections.push(`
## Repository Git

La directory corrente non è un repository Git.
`);
  }
  
  // Verifica disponibilità CLI
  onProgress?.("Verifica disponibilità CLI...");
  try {
    const cliAvailability = await checkCLIAvailability();
    metadata.cliAvailability = cliAvailability;
    
    sections.push(`
## Disponibilità CLI

- **Qwen**: ${cliAvailability.qwen ? "✅ Disponibile" : "❌ Non disponibile"}
- **Gemini**: ${cliAvailability.gemini ? "✅ Disponibile" : "❌ Non disponibile"}
- **ACLI**: ${cliAvailability.acli ? "✅ Disponibile" : "❌ Non disponibile"}
`);
    
    // Avvisi se qualche CLI non è disponibile
    const unavailable = Object.entries(cliAvailability)
      .filter(([_, available]) => !available)
      .map(([name]) => name);
    
    if (unavailable.length > 0) {
      sections.push(`
### ⚠️ Avviso

Le seguenti CLI non sono disponibili: ${unavailable.join(", ")}
Alcuni workflow potrebbero non funzionare correttamente.
`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    sections.push(`
## Errore nella verifica CLI

${errorMsg}
`);
  }
  
  // Informazioni sulla sessione
  const now = new Date();
  metadata.sessionStartTime = now.toISOString();
  metadata.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  sections.push(`
## Informazioni Sessione

- **Data e ora**: ${now.toLocaleString()}
- **Timezone**: ${metadata.timezone}
- **Directory di lavoro**: ${process.cwd()}
`);
  
  onProgress?.("Sessione inizializzata con successo");
  
  return formatWorkflowOutput("Report Inizializzazione Sessione", sections.join("\n"), metadata);
}

/**
 * Definizione del workflow init-session
 */
export const initSessionWorkflow: WorkflowDefinition = {
  description: "Inizializza la sessione corrente analizzando il repository Git e verificando la disponibilità delle CLI",
  schema: initSessionSchema,
  execute: executeInitSession
};
