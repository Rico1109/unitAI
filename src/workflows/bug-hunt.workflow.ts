/**
 * Bug Hunt Workflow
 * 
 * Searches for and analyzes bugs based on symptoms.
 * Uses AI to discover relevant files and perform parallel analysis.
 */

import { z } from 'zod';
import type { WorkflowDefinition, ProgressCallback } from './types.js';
import { executeAIClient, BACKENDS } from '../utils/aiExecutor.js';
import { formatWorkflowOutput } from './utils.js';
import { logAudit } from '../utils/auditTrail.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Schema dei parametri per bug-hunt
 */
export const bugHuntSchema = z.object({
  symptoms: z.string().describe('Descrizione dei sintomi del problema'),
  suspected_files: z.array(z.string()).optional().describe('File sospetti da analizzare'),
  autonomyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'AUTONOMOUS'])
    .default('MEDIUM')
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
async function executeBugHunt(
  params: BugHuntParams,
  onProgress?: ProgressCallback
): Promise<string> {
  const { symptoms, suspected_files } = params;

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
      backend: BACKENDS.QWEN,
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

  const [geminiAnalysis, rovodevAnalysis] = await Promise.all([
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
    }),
    executeAIClient({
      backend: BACKENDS.ROVODEV,
      prompt: `Analyze these files and provide a practical fix for the bug.

Symptoms: ${symptoms}

Files:
${fileContents.map(f => `\n--- ${f.path} ---\n${f.content}`).join('\n')}

Provide:
1. Specific code changes needed
2. Step-by-step fix instructions
3. How to test the fix
4. Potential risks`
    })
  ]);

  // Step 3: Check if we need to analyze related files
  const problematicFiles = fileContents.filter(f => 
    hasIssue(geminiAnalysis) || hasIssue(rovodevAnalysis)
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

## Root Cause Analysis (Gemini)
${geminiAnalysis}

---

## Practical Fix Recommendations (Rovodev)
${rovodevAnalysis}

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
