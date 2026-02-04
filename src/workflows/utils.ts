import { executeAIClient } from "../services/ai-executor.js";
import { BACKENDS } from "../constants.js";
import {
  createPermissionManager,
  getDefaultAutonomyLevel,
  type PermissionManager
} from "../utils/security/permissionManager.js";
import type {
  ProgressCallback,
  AIAnalysisResult,
  ParallelAnalysisResult,
  ReviewFocus,
  BaseWorkflowParams
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

/**
 * Creates a PermissionManager from workflow parameters
 *
 * Extracts autonomyLevel from parameters (if present) and creates a PermissionManager
 * with the appropriate level. If not specified, uses the default level (READ_ONLY).
 *
 * @param params - Workflow parameters extending BaseWorkflowParams
 * @returns PermissionManager configured with the appropriate autonomy level
 *
 * @example
 * ```typescript
 * async function myWorkflow(params: MyWorkflowParams) {
 *   const permissions = createWorkflowPermissionManager(params);
 *
 *   // Check permissions before risky operations
 *   if (permissions.git.canCommit()) {
 *     // Execute commit
 *   }
 *
 *   // Or assert that throws error if not allowed
 *   permissions.git.assertPush("pushing to remote");
 * }
 * ```
 */
export function createWorkflowPermissionManager(
  params: BaseWorkflowParams
): PermissionManager {
  const level = params.autonomyLevel || getDefaultAutonomyLevel();
  return createPermissionManager(level);
}

// ============================================================================
// Agent Integration Helpers
// ============================================================================

/**
 * Creates an AgentConfig from workflow parameters
 *
 * Converts workflow parameters to an Agent-compatible configuration,
 * handling autonomy level and progress callback.
 *
 * @param params - Workflow parameters extending BaseWorkflowParams
 * @param onProgress - Optional callback for progress reporting
 * @returns AgentConfig ready for use with agents
 *
 * @example
 * ```typescript
 * import { AgentFactory } from "../agents/index.js";
 *
 * async function myWorkflow(params: MyWorkflowParams) {
 *   const config = createAgentConfig(params, (msg) => console.log(msg));
 *   const architect = AgentFactory.createArchitect();
 *
 *   const result = await architect.execute({
 *     task: "Analyze system architecture",
 *     files: params.files
 *   }, config);
 * }
 * ```
 */
export function createAgentConfig(
  params: BaseWorkflowParams,
  onProgress?: ProgressCallback
): import("../domain/agents/types.js").AgentConfig {
  const level = params.autonomyLevel || getDefaultAutonomyLevel();

  return {
    autonomyLevel: level,
    onProgress,
    timeout: 300000 // 5 minutes default timeout
  };
}

/**
 * Formats agent results for display
 *
 * Converts structured agent output to a readable format
 * for the user, including metadata and error handling.
 *
 * @param result - Result of an agent execution
 * @param agentName - Nome dell'agent (per il titolo)
 * @returns Stringa formattata pronta per la visualizzazione
 *
 * @example
 * ```typescript
 * const result = await architect.execute(input, config);
 * const formatted = formatAgentResults(result, "ArchitectAgent");
 * console.log(formatted);
 * ```
 */
export function formatAgentResults<T>(
  result: import("../domain/agents/types.js").AgentResult<T>,
  agentName: string
): string {
  let output = `# ${agentName} Results\n\n`;

  // Status badge
  const statusBadge = result.success ? "✅ SUCCESS" : "❌ FAILED";
  output += `**Status:** ${statusBadge}\n\n`;

  // Metadata
  if (result.metadata) {
    output += "## Metadata\n\n";
    output += `- **Backend:** ${result.metadata.backend}\n`;
    output += `- **Execution Time:** ${result.metadata.executionTime}ms\n`;
    output += `- **Autonomy Level:** ${result.metadata.autonomyLevel}\n`;

    // Add any additional metadata
    Object.entries(result.metadata).forEach(([key, value]) => {
      if (!["backend", "executionTime", "autonomyLevel"].includes(key)) {
        output += `- **${key}:** ${JSON.stringify(value)}\n`;
      }
    });
    output += "\n";
  }

  // Error handling
  if (!result.success && result.error) {
    output += "## Error\n\n";
    output += `\`\`\`\n${result.error}\n\`\`\`\n\n`;
  }

  // Output (serialize as JSON for complex types)
  output += "## Output\n\n";
  if (typeof result.output === "string") {
    output += result.output;
  } else {
    output += "```json\n";
    output += JSON.stringify(result.output, null, 2);
    output += "\n```\n";
  }

  return output;
}
