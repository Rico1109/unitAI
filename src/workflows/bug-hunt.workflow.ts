/**
 * Bug Hunt Workflow
 *
 * Searches for and analyzes bugs based on symptoms.
 * Uses AI to discover relevant files and perform parallel analysis.
 */

import { z } from 'zod';
import type { WorkflowDefinition, ProgressCallback } from '../domain/workflows/types.js';
import { executeAIClient } from '../services/ai-executor.js';
import { getRoleBackend } from '../config/config.js';
import { formatWorkflowOutput, formatScorecard, appendRunLog } from './utils.js';
import type { RunLogEntry } from './utils.js';
import { selectParallelBackends, createTaskCharacteristics } from './model-selector.js';
import { logAudit } from '../services/audit-trail.js';
import { getDependencies } from '../dependencies.js';
import { AutonomyLevel, OperationType, assertPermission } from '../utils/security/permissionManager.js';
import { validateFilePath } from '../utils/security/pathValidator.js';
import { sanitizeUserInput } from '../utils/security/inputSanitizer.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Schema dei parametri per bug-hunt
 */
export const bugHuntSchema = z.object({
  symptoms: z.string().describe('Descrizione dei sintomi del problema'),
  suspected_files: z.array(z.string()).optional().describe('File sospetti da analizzare'),
  autonomyLevel: z.enum(["auto", "read-only", "low", "medium", "high"])
    .describe('Ask the user: "What permission level for this workflow? auto = I choose the minimum needed, read-only = analysis only, low = file writes allowed, medium = git commit/branch/install deps, high = git push + external APIs." Use auto if unsure.'),
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
    const safePath = validateFilePath(filePath);
    const content = readFileSync(safePath, 'utf-8');
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
  const { symptoms: rawSymptoms, suspected_files, attachments = [], backendOverrides } = params;
  const symptoms = sanitizeUserInput(rawSymptoms);
  const workflowStart = Date.now();
  const scorePhases: RunLogEntry['phases'] = [];

  // autonomyLevel is always a concrete AutonomyLevel here (registry resolves "auto")
  const level = (params.autonomyLevel as AutonomyLevel) ?? AutonomyLevel.MEDIUM;
  assertPermission(level, OperationType.WRITE_FILE, 'this workflow may write files via AI agents');

  await logAudit({
    operation: 'bug-hunt-start',
    autonomyLevel: level,
    details: `Hunting bug with symptoms: ${symptoms}`
  });

  let filesToAnalyze = suspected_files || [];

  // Role-based backend selection (resolved once per workflow run)
  const architectBackend   = getRoleBackend('architect');
  const implementerBackend = getRoleBackend('implementer');
  const testerBackend      = getRoleBackend('tester');

  // Step 1: Find files if not provided
  if (filesToAnalyze.length === 0) {
    onProgress?.('🔍 Searching codebase for relevant files...');

    const searchResults = await executeAIClient({
      backend: architectBackend,
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
    .flatMap(f => {
      try {
        const safePath = validateFilePath(f);
        return [{ path: f, content: readFileSync(safePath, 'utf-8') }];
      } catch {
        return [];
      }
    });

  // Dynamic Backend Selection
  const { circuitBreaker } = getDependencies();
  const task = createTaskCharacteristics('bug-hunt');
  const selectedBackends = backendOverrides && backendOverrides.length > 0
    ? backendOverrides
    : await selectParallelBackends(task, circuitBreaker, 3);

  const runArchitect   = selectedBackends.includes(architectBackend);
  const runImplementer = selectedBackends.includes(implementerBackend);
  const runTester      = selectedBackends.includes(testerBackend);

  let architectAnalysis = '';
  let testerAnalysis = '';

  const analysisTasks: Promise<void>[] = [];

  // Primary Analysis (architect or tester as fallback)
  const analysisStart = Date.now();
  if (runArchitect) {
    analysisTasks.push(
      executeAIClient({
        backend: architectBackend,
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
        architectAnalysis = result;
      }).catch(error => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        architectAnalysis = `Unable to complete analysis with architect: ${errorMsg}`;
      })
    );
  } else if (runTester) {
    analysisTasks.push(
      executeAIClient({
        backend: testerBackend,
        prompt: `Analyze these files for the reported bug.
Symptoms: ${symptoms}
Files:
${fileContents.map(f => `\n--- ${f.path} ---\n${f.content}`).join('\n')}
Provide root cause analysis and potential side effects.`,
        outputFormat: 'text'
      }).then(result => {
        testerAnalysis = result;
      }).catch(error => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        testerAnalysis = `Unable to complete analysis with tester: ${errorMsg}`;
      })
    );
  }

  await Promise.all(analysisTasks);
  const analysisMs = Date.now() - analysisStart;
  const analysisBackend = runArchitect ? architectBackend : (runTester ? testerBackend : 'none');
  const analysisSuccess = runArchitect
    ? !architectAnalysis.startsWith('Unable to complete')
    : !testerAnalysis.startsWith('Unable to complete');
  scorePhases.push({
    name: 'root-cause-analysis',
    backend: analysisBackend,
    durationMs: analysisMs,
    success: analysisSuccess
  });

  let hypothesis = '';
  let hypothesisBackend = '';

  // Hypothesis: tester is fast and logical, implementer as fallback
  if (runTester) {
    hypothesisBackend = testerBackend;
  } else if (runImplementer) {
    hypothesisBackend = implementerBackend;
  }

  if (hypothesisBackend) {
    onProgress?.(`🧠 Generating hypotheses with ${hypothesisBackend}...`);
    const hypothesisStart = Date.now();
    let hypothesisSuccess = true;
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
      hypothesisSuccess = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      hypothesis = `Unable to execute hypothesis generation: ${errorMsg}`;
    }
    scorePhases.push({
      name: 'hypothesis',
      backend: hypothesisBackend,
      durationMs: Date.now() - hypothesisStart,
      success: hypothesisSuccess
    });
  }

  let remediationPlan = '';
  if (runImplementer) {
    onProgress?.('🤖 Preparing remediation plan with implementer...');
    const remediationStart = Date.now();
    let remediationSuccess = true;
    try {
      remediationPlan = await executeAIClient({
        backend: implementerBackend,
        prompt: `Create an operational plan to resolve the described bugs.
Symptoms: ${symptoms}
Files:
${filesToAnalyze.join("\n")}
Required output:
- Remediation steps (max 5) with priorities
- Automated checks for each step
- Residual risks`,
        autonomyLevel: level,
        attachments,
        outputFormat: "text"
      });
    } catch (error) {
      remediationSuccess = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      remediationPlan = `Unable to generate fix plan with implementer: ${errorMsg}`;
    }
    scorePhases.push({
      name: 'remediation-plan',
      backend: implementerBackend,
      durationMs: Date.now() - remediationStart,
      success: remediationSuccess
    });
  }

  // Step 3: Check if we need to analyze related files
  const problematicFiles = fileContents.filter(f =>
    hasIssue(architectAnalysis)
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

  const totalMs = Date.now() - workflowStart;
  const overallSuccess = scorePhases.every(p => p.success);
  const scorecard = formatScorecard(scorePhases, totalMs);

  const report = `
# Bug Hunt Report

## Symptoms
${symptoms}

## Files Analyzed
${filesToAnalyze.join('\n')}

---

## Root Cause Analysis
${architectAnalysis || testerAnalysis}

---

${hypothesis ? `---\n\n## Hypothesis Exploration\n${hypothesis}\n` : ''}

${remediationPlan ? `---\n\n## Autonomous Fix Plan\n${remediationPlan}\n` : ''}

${relatedFilesAnalysis}

---

## Summary
- **Files Analyzed**: ${filesToAnalyze.length}
- **Problematic Files**: ${problematicFiles.length}
- **Related Files**: ${relatedFilesAnalysis ? 'Yes' : 'No'}

${scorecard}
`;

  await logAudit({
    operation: 'bug-hunt-complete',
    autonomyLevel: level,
    details: `Analyzed ${filesToAnalyze.length} files`
  });

  appendRunLog({
    ts: new Date().toISOString(),
    workflow: 'bug-hunt',
    phases: scorePhases,
    totalDurationMs: totalMs,
    success: overallSuccess
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
