import { z } from "zod";
import { getGitRepoInfo, getGitDiff, getDetailedGitStatus, getGitBranches, checkCLIAvailability, isGitRepository } from "../utils/gitHelper.js";
import { formatWorkflowOutput } from "./utils.js";
import type { WorkflowDefinition, ProgressCallback } from "./types.js";

/**
 * Schema Zod per il workflow init-session
 */
const initSessionSchema = z.object({});

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

      // Commit recenti
      sections.push(`
## Commit Recenti

${repoInfo.recentCommits.map(commit => `- ${commit}`).join("\n")}
`);

      // Diff degli ultimi 3 commit
      onProgress?.("Analisi modifiche recenti...");
      const recentDiff = await getGitDiff("HEAD~3");
      if (recentDiff.trim()) {
        sections.push(`
## Modifiche Recenti (ultimi 3 commit)

\`\`\`diff
${recentDiff.substring(0, 2000)}${recentDiff.length > 2000 ? "\n... (troncato)" : ""}
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
