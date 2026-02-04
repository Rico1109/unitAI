/**
 * Bug Hunt Workflow
 * 
 * Searches for and analyzes bugs based on symptoms.
 * Uses AI to discover relevant files and perform parallel analysis.
 */

import { z } from 'zod';
import type { WorkflowDefinition, ProgressCallback } from '../domain/workflows/types.js';
import { executeAIClient, BACKENDS } from '../services/ai-executor.js';
import { formatWorkflowOutput } from './utils.js';
import { selectParallelBackends, createTaskCharacteristics } from './model-selector.js';
import { logAudit } from '../services/audit-trail.js';
import { getDependencies } from '../dependencies.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Schema dei parametri per bug-hunt
 */
export const bugHuntSchema = z.object({
  symptoms: z.string().describe('Descrizione dei sintomi del problema'),
  suspected_files: z.array(z.string()).optional().describe('File sospetti da analizzare'),
  autonomyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'AUTONOMOUS'])
    .default('MEDIUM'),
  attachments: z.array(z.string())
    .optional()
    .describe('File aggiuntivi da allegare alle analisi (es. log)'),
  backendOverrides: z.array(z.string())
    .optional()
    .describe('Override dei backend AI per l\'analisi')
});

export type BugHuntParams = z.infer<typeof bugHuntSchema>;

/**
 * Extract file paths from AI response
 */
function extractFilePaths(response: string): string[] {
  const lines = response.split('\n');
  const filePaths: string[] = [];

  for (const line of lines) {
    // Match common file path patterns
    const matches = line.match(/(?:^|\s)([a-zA-Z0-9_\-./]+\.(?:ts|js|tsx|jsx|json|md))/g);
    if (matches) {
      for (const match of matches) {
        const path = match.trim();
        if (existsSync(path)) {
          filePaths.push(path);
        }
      }
    }
  }

  return [...new Set(filePaths)]; // Remove duplicates
}

/**
 * Check if analysis indicates an issue
 */
function hasIssue(analysis: string): boolean {
  const issueKeywords = [
    'bug', 'error', 'issue', 'problem', 'wrong', 'incorrect',
    'missing', 'broken', 'fail', 'crash', 'exception'
  ];

  const lowerAnalysis = analysis.toLowerCase();
  return issueKeywords.some(keyword => lowerAnalysis.includes(keyword));
}

/**
 * Find related files based on imports and references
 */
async function findRelatedFiles(filePath: string): Promise<string[]> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const relatedFiles: string[] = [];

    // Extract import statements
    const importMatches = content.matchAll(/import.*from\s+['"](.+?)['"]/g);
    for (const match of importMatches) {
      let importPath = match[1];

      // Resolve relative imports
      if (importPath.startsWith('.')) {
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        importPath = join(dir, importPath);

        // Try adding common extensions
        for (const ext of ['.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js']) {
          const fullPath = importPath + ext;
          if (existsSync(fullPath)) {
            relatedFiles.push(fullPath);
            break;
          }
        }
      }
    }

    return [...new Set(relatedFiles)];
  } catch (error) {
    console.warn(`Failed to find related files for ${filePath}:`, error);
    return [];
  }
}

/**
 * Execute bug hunt workflow
 */
export async function executeBugHunt(
  params: BugHuntParams,
  onProgress?: ProgressCallback
): Promise<string> {
  const { symptoms, suspected_files, attachments = [], backendOverrides } = params;

  await logAudit({
    operation: 'bug-hunt-start',
    autonomyLevel: params.autonomyLevel || 'MEDIUM',
    details: `Hunting bug with symptoms: ${symptoms}`
  });

  let filesToAnalyze = suspected_files || [];

  // Step 1: Find files if not provided
  if (filesToAnalyze.length === 0) {
    onProgress?.('🔍 Searching codebase for relevant files...');

    const searchResults = await executeAIClient({
      backend: BACKENDS.GEMINI,
      prompt: `Given these bug symptoms, list the most likely files in the codebase that could be causing the issue.

Symptoms: ${symptoms}

Consider:
- Error messages and stack traces
- Component/module names mentioned
- Common locations for such issues

List only file paths, one per line, in order of likelihood.`
    });

    filesToAnalyze = extractFilePaths(searchResults);

    if (filesToAnalyze.length === 0) {
      return formatWorkflowOutput('Bug Hunt', 'Unable to identify relevant files. Please provide suspected files manually.');
    }

    onProgress?.(`📁 Identified ${filesToAnalyze.length} files to analyze`);
  }

  // Step 2: Parallel analysis with different backends
  onProgress?.('🔬 Analyzing files with multiple AI backends...');

  const fileContents = filesToAnalyze
    .filter(f => existsSync(f))
    .map(f => ({ path: f, content: readFileSync(f, 'utf-8') }));

  // Dynamic Backend Selection
  const { circuitBreaker } = getDependencies();
  const task = createTaskCharacteristics('bug-hunt');
  const selectedBackends = backendOverrides && backendOverrides.length > 0
    ? backendOverrides
    : await selectParallelBackends(task, circuitBreaker, 3); // Try to get up to 3 backends

  const runGemini = selectedBackends.includes(BACKENDS.GEMINI);
  const runCursor = selectedBackends.includes(BACKENDS.CURSOR);
  const runDroid = selectedBackends.includes(BACKENDS.DROID);
  const runRovodev = selectedBackends.includes(BACKENDS.ROVODEV);
  const runQwen = selectedBackends.includes(BACKENDS.QWEN);

  let geminiAnalysis = '';
  let qwenAnalysis = '';

  const analysisTasks: Promise<void>[] = [];

  // Primary Analysis (Gemini or Qwen)
  if (runGemini) {
    analysisTasks.push(
      executeAIClient({
        backend: BACKENDS.GEMINI,
        prompt: `Analyze these files for the reported bug.
Symptoms: ${symptoms}
Files:
${fileContents.map(f => `\n--- ${f.path} ---\n${f.content}`).join('\n')}
Provide:
1. Root cause analysis
2. Affected code sections
3. Why this causes the symptoms
4. Potential side effects`
      }).then(result => {
        geminiAnalysis = result;
      }).catch(error => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        geminiAnalysis = `Unable to complete analysis with Gemini: ${errorMsg}`;
      })
    );
  } else if (runQwen) {
    // Fallback/Alternative to Gemini
    analysisTasks.push(
      executeAIClient({
        backend: BACKENDS.QWEN,
        prompt: `Analyze these files for the reported bug.
Symptoms: ${symptoms}
Files:
${fileContents.map(f => `\n--- ${f.path} ---\n${f.content}`).join('\n')}
Provide root cause analysis and potential side effects.`,
        outputFormat: 'text'
      }).then(result => {
        qwenAnalysis = result;
      }).catch(error => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        qwenAnalysis = `Unable to complete analysis with Qwen: ${errorMsg}`;
      })
    );
  }

  await Promise.all(analysisTasks);

  let hypothesis = '';
  let hypothesisBackend = '';

  if (runQwen) {
    hypothesisBackend = BACKENDS.QWEN;
  } else if (runCursor) {
    hypothesisBackend = BACKENDS.CURSOR;
  }

  if (hypothesisBackend) {
    onProgress?.(`🧠 Generating hypotheses with ${hypothesisBackend}...`);
    try {
      hypothesis = await executeAIClient({
        backend: hypothesisBackend,
        prompt: `Act as a code investigator. You have the following symptoms and analyzed files.
Symptoms: ${symptoms}
Main files:
${filesToAnalyze.join("\n")}
Generate:
1. 3-5 hypotheses ordered by probability
2. Evidence required to confirm them
3. Suggested experiments/tools
4. Metrics to monitor`,
        attachments,
        outputFormat: "text"
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      hypothesis = `Unable to execute ${hypothesisBackend}: ${errorMsg}`;
    }
  }

  let remediationPlan = '';
  // Use Droid OR Rovodev for remediation
  if (runDroid) {
    onProgress?.('🤖 Preparing remediation plan with Droid...');
    try {
      remediationPlan = await executeAIClient({
        backend: BACKENDS.DROID,
        prompt: `Create an operational plan to resolve the described bugs.
Symptoms: ${symptoms}
Files:
${filesToAnalyze.join("\n")}
Required output:
- Remediation steps (max 5) with priorities
- Automated checks for each step
- Residual risks`,
        auto: "medium",
        attachments,
        outputFormat: "text"
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      remediationPlan = `Unable to generate fix plan with Droid: ${errorMsg}`;
    }
  } else if (runRovodev) {
    onProgress?.('🤖 Preparing remediation plan with Rovodev...');
    try {
      remediationPlan = await executeAIClient({
        backend: BACKENDS.ROVODEV,
        prompt: `Create an operational plan to resolve the described bugs.
  Symptoms: ${symptoms}
  Files:
  ${filesToAnalyze.join("\n")}`,
        autoApprove: true // Yolo mode for planning
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      remediationPlan = `Unable to generate fix plan with Rovodev: ${errorMsg}`;
    }
  }

  // Step 3: Check if we need to analyze related files
  const problematicFiles = fileContents.filter(f =>
    hasIssue(geminiAnalysis)
  );

  let relatedFilesAnalysis = '';
  if (problematicFiles.length > 0) {
    onProgress?.('🔗 Searching for related files...');

    const relatedFiles: string[] = [];
    for (const file of problematicFiles) {
      const related = await findRelatedFiles(file.path);
      relatedFiles.push(...related);
    }

    const uniqueRelated = [...new Set(relatedFiles)].filter(
      f => !filesToAnalyze.includes(f)
    );

    if (uniqueRelated.length > 0) {
      onProgress?.(`📎 Analyzing ${uniqueRelated.length} related files...`);

      relatedFilesAnalysis = `\n\n### Related Files Impact\n${uniqueRelated.join(', ')}`;
    }
  }

  // Step 4: Synthesize comprehensive report
  onProgress?.('📝 Generating comprehensive bug report...');

  const report = `
# Bug Hunt Report

## Symptoms
${symptoms}

## Files Analyzed
${filesToAnalyze.join('\n')}

---

## Root Cause Analysis (Gemini/Qwen)
${geminiAnalysis || qwenAnalysis}

---

${hypothesis ? `---

## Hypothesis Exploration (Cursor Agent / Qwen)
${hypothesis}
` : ''}

${remediationPlan ? `---

## Autonomous Fix Plan (Droid/Rovodev)
${remediationPlan}
` : ''}

${relatedFilesAnalysis}

---

## Summary
- **Files Analyzed**: ${filesToAnalyze.length}
- **Problematic Files**: ${problematicFiles.length}
- **Related Files**: ${relatedFilesAnalysis ? 'Yes' : 'No'}
`;

  await logAudit({
    operation: 'bug-hunt-complete',
    autonomyLevel: params.autonomyLevel || 'MEDIUM',
    details: `Analyzed ${filesToAnalyze.length} files`
  });

  return formatWorkflowOutput('Bug Hunt', report);
}

/**
 * Bug hunt workflow definition
 */
export const bugHuntWorkflow: WorkflowDefinition = {
  name: 'bug-hunt',
  description: 'Hunts for bugs based on symptoms using AI-powered analysis',
  schema: bugHuntSchema as any,
  execute: executeBugHunt
};
