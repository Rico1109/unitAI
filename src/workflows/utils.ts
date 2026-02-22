import fs from 'fs';
import path from 'path';
import os from 'os';
import { executeAIClient } from "../services/ai-executor.js";
import { BACKENDS } from "../constants.js";
import type {
  ProgressCallback,
  AIAnalysisResult,
  ParallelAnalysisResult,
  ReviewFocus
} from "../domain/workflows/types.js";
import type { AIExecutionOptions } from "../services/ai-executor.js";

/**
 * Executes an AI analysis with a specific backend
 */
export async function runAIAnalysis(
  backend: string,
  prompt: string,
  options: Partial<Omit<AIExecutionOptions, "backend" | "prompt">> = {},
  onProgress?: ProgressCallback
): Promise<AIAnalysisResult> {
  try {
    onProgress?.(`Avvio analisi con ${backend}...`);

    const {
      onProgress: optionProgress,
      ...restOptions
    } = options;

    const output = await executeAIClient({
      backend,
      prompt,
      ...restOptions,
      onProgress: (msg) => {
        optionProgress?.(msg);
        onProgress?.(`${backend}: ${msg}`);
      }
    });

    return {
      backend,
      output,
      success: true
    };
  } catch (error) {
    return {
      backend,
      output: "",
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Executes parallel analysis with multiple AI backends
 */
export async function runParallelAnalysis(
  backends: string[],
  promptBuilder: (backend: string) => string,
  onProgress?: ProgressCallback,
  optionsBuilder?: (backend: string) => Partial<Omit<AIExecutionOptions, "backend" | "prompt">>
): Promise<ParallelAnalysisResult> {
  onProgress?.(`Avvio analisi parallela con ${backends.length} backend...`);

  const promises = backends.map(backend =>
    runAIAnalysis(
      backend,
      promptBuilder(backend),
      optionsBuilder ? optionsBuilder(backend) || {} : {},
      onProgress
    )
  );

  const results = await Promise.all(promises);

  // Synthesis of results
  const synthesis = synthesizeResults(results);

  return {
    results,
    synthesis
  };
}

/**
 * Synthesizes results from multiple analyses
 */
export function synthesizeResults(results: AIAnalysisResult[]): string {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  let synthesis = "# Combined Analysis\n\n";

  // Add successful results
  if (successful.length > 0) {
    synthesis += "## Analysis Results\n\n";

    successful.forEach(result => {
      synthesis += `### ${result.backend}\n\n`;
      synthesis += `${result.output}\n\n`;
    });
  }

  // Add errors if present
  if (failed.length > 0) {
    synthesis += "## Detected Errors\n\n";

    failed.forEach(result => {
      synthesis += `### ${result.backend}\n\n`;
      synthesis += `**Errore:** ${result.error}\n\n`;
    });
  }

  return synthesis;
}

/**
 * Builds a code review prompt based on focus
 */
export function buildCodeReviewPrompt(
  files: string[],
  focus: ReviewFocus = "all"
): string {
  let focusInstructions = "";

  switch (focus) {
    case "architecture":
      focusInstructions = `
Focus on code architecture:
- Project structure and organization
- Design patterns used
- Separation of responsibilities
- Coupling and cohesion
- Scalability and maintainability
`;
      break;
    case "security":
      focusInstructions = `
Focus on code security:
- Common vulnerabilities (SQL injection, XSS, CSRF)
- Authentication and authorization management
- Input validation
- Sensitive data management
- Security configurations
`;
      break;
    case "performance":
      focusInstructions = `
Focus on code performance:
- Algorithm efficiency
- Memory usage
- Computational complexity
- Possible optimizations
- Bottlenecks
`;
      break;
    case "quality":
      focusInstructions = `
Focus on code quality:
- Readability and maintainability
- Test coverage
- Error handling
- Documentation
- Language best practices
`;
      break;
    case "all":
    default:
      focusInstructions = `
Complete code analysis including:
- Architecture and design
- Security
- Performance
- Quality and maintainability
- Best practices
`;
      break;
  }

  return `
Analyze the following files: ${files.join(", ")}

${focusInstructions}

Provide a detailed analysis with:
1. Identified strengths
2. Issues or areas for improvement
3. Specific recommendations
4. Issue priority (if applicable)

Be specific and provide concrete examples when possible.
`;
}

/**
 * Builds a prompt for bug hunting
 */
export function buildBugHuntPrompt(
  symptoms: string,
  suspectedFiles?: string[]
): string {
  let filesSection = "";
  if (suspectedFiles && suspectedFiles.length > 0) {
    filesSection = `
Suspected files to analyze:
${suspectedFiles.map(f => `- ${f}`).join("\n")}
`;
  }

  return `
Problem symptoms: ${symptoms}

${filesSection}

Analyze the problem following this approach:
1. Identify possible root causes
2. Look for common bug patterns related
3. Suggest a debugging plan
4. Propose specific solutions
5. Indicate how to prevent similar problems in the future

Pay attention to:
- Race conditions
- Null/undefined handling errors
- Asynchronous issues
- Memory leak
- Logic errors
`;
}

/**
 * Formats output for display
 */
export function formatWorkflowOutput(
  title: string,
  content: string,
  metadata?: Record<string, any>
): string {
  let output = `# ${title}\n\n`;

  if (metadata) {
    output += "## Metadata\n\n";
    Object.entries(metadata).forEach(([key, value]) => {
      output += `- **${key}**: ${value}\n`;
    });
    output += "\n";
  }

  output += content;

  return output;
}

/**
 * Extracts file name from full path
 */
export function extractFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}

/**
 * Checks if a file is of a certain type
 */
export function isFileType(filePath: string, extensions: string[]): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ext ? extensions.includes(ext) : false;
}



// ============================================================================
// Observability: Run Log + Scorecard
// ============================================================================

export interface RunLogEntry {
  ts: string;
  workflow: string;
  phases: Array<{
    name: string;
    backend: string;
    durationMs: number;
    success: boolean;
    error?: string;
  }>;
  totalDurationMs: number;
  success: boolean;
}

export function appendRunLog(entry: RunLogEntry): void {
  const logPath = path.join(os.homedir(), '.unitai', 'run-log.jsonl');
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Append the new entry
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');

  // Cap at 500 lines by trimming from top
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 500) {
      const trimmed = lines.slice(lines.length - 500).join('\n') + '\n';
      fs.writeFileSync(logPath, trimmed, 'utf8');
    }
  } catch {
    // ignore trim errors
  }
}

export function formatScorecard(
  phases: Array<{ name: string; backend: string; durationMs: number; success: boolean }>,
  totalMs: number
): string {
  const rows = phases.map(p => {
    const dur = p.durationMs < 1000
      ? `${p.durationMs}ms`
      : `${Math.round(p.durationMs / 1000)}s`;
    const status = p.success ? '✅' : '❌';
    return `| ${p.name} | ${p.backend} | ${dur} | ${status} |`;
  });

  const totalDur = totalMs < 1000
    ? `${totalMs}ms`
    : `${Math.round(totalMs / 1000)}s`;
  const allSuccess = phases.every(p => p.success);
  rows.push(`| **Total** | | ${totalDur} | ${allSuccess ? '✅' : '❌'} |`);

  return [
    '## Run Scorecard',
    '| Phase | Backend | Duration | Status |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}
