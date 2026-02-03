import { z } from "zod";
import type {
  WorkflowDefinition,
  ProgressCallback,
  ParallelReviewParams,
  PreCommitValidateParams,
  ValidateLastCommitParams,
  BugHuntParams
} from "../domain/workflows/types.js";

// Import workflow definitions
import { parallelReviewWorkflow } from "./parallel-review.workflow.js";
import { preCommitValidateWorkflow } from "./pre-commit-validate.workflow.js";
import { initSessionWorkflow } from "./init-session.workflow.js";
import { validateLastCommitWorkflow } from "./validate-last-commit.workflow.js";
import { featureDesignWorkflow } from "./feature-design.workflow.js";
import { bugHuntWorkflow } from "./bug-hunt.workflow.js";
import { triangulatedReviewWorkflow } from "./triangulated-review.workflow.js";
import { autoRemediationWorkflow } from "./auto-remediation.workflow.js";
import { refactorSprintWorkflow } from "./refactor-sprint.workflow.js";
import { overthinkerWorkflow } from "./overthinker.workflow.js";

/**
 * Registry of all available workflows
 */
const workflowRegistry: Record<string, WorkflowDefinition> = {};
let workflowsInitialized = false;

function ensureWorkflowsInitialized(): void {
  if (!workflowsInitialized) {
    initializeWorkflowRegistry();
  }
}

/**
 * Registra un workflow nel registro
 */
export function registerWorkflow<TParams>(
  name: string, 
  workflow: WorkflowDefinition<TParams>
): void {
  workflowRegistry[name] = workflow;
}

/**
 * Ottiene un workflow dal registro
 */
export function getWorkflow(name: string): WorkflowDefinition | undefined {
  ensureWorkflowsInitialized();
  return workflowRegistry[name];
}

/**
 * Lists all available workflows
 */
export function listWorkflows(): string[] {
  ensureWorkflowsInitialized();
  return Object.keys(workflowRegistry);
}

/**
 * Executes a workflow by name
 */
export async function executeWorkflow(
  name: string,
  params: any,
  onProgress?: ProgressCallback
): Promise<string> {
  ensureWorkflowsInitialized();
  const workflow = getWorkflow(name);
  if (!workflow) {
    throw new Error(`Workflow not found: ${name}`);
  }
  
  try {
    // Parameter validation
    const validatedParams = workflow.schema.parse(params);

    // Workflow execution
    return await workflow.execute(validatedParams, onProgress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      throw new Error(`Invalid parameters for workflow ${name}: ${errorDetails}`);
    }
    throw error;
  }
}

/**
 * Zod schema for the workflow router
 */
export const smartWorkflowsSchema = z.object({
  workflow: z.enum([
    "parallel-review",
    "pre-commit-validate",
    "init-session",
    "validate-last-commit",
    "feature-design",
    "bug-hunt",
    "triangulated-review",
    "auto-remediation",
    "refactor-sprint",
    "overthinker"
  ]).describe("Workflow to execute"),
  params: z.record(z.any()).optional().describe("Workflow-specific parameters")
});

/**
 * Definitions of schemas for each workflow
 */
export const workflowSchemas = {
  "parallel-review": z.object({
    files: z.array(z.string()).describe("Files to analyze"),
    focus: z.enum(["architecture", "security", "performance", "quality", "all"])
      .optional().default("all").describe("Focus area of the analysis"),
    strategy: z.enum(["standard", "double-check"]).optional().default("standard")
      .describe("Review strategy"),
    backendOverrides: z.array(z.string()).optional()
      .describe("Manual override of backends"),
    attachments: z.array(z.string()).optional()
      .describe("Files to attach to Cursor/Droid"),
    writeReport: z.boolean().optional().describe("Legacy parameter (unused)")
  }),
  
  "pre-commit-validate": z.object({
    depth: z.enum(["quick", "thorough", "paranoid"])
      .optional().default("thorough").describe("Validation depth")
  }),
  
  "init-session": z.object({
    autonomyLevel: z.enum(["read-only", "low", "medium", "high"]).optional(),
    commitCount: z.number().int().min(1).max(50).optional()
  }).describe("Optional parameters for init-session"),
  
  "validate-last-commit": z.object({
    commit_ref: z.string().optional().default("HEAD")
      .describe("Reference to the commit to validate")
  }),

  "feature-design": z.object({
    featureDescription: z.string().describe("Description of the feature to implement"),
    targetFiles: z.array(z.string()).describe("Files to create or modify"),
    context: z.string().optional().describe("Additional context about the project"),
    architecturalFocus: z.enum(["design", "refactoring", "optimization", "security", "scalability"])
      .optional().default("design").describe("Focus of the architectural analysis"),
    implementationApproach: z.enum(["incremental", "full-rewrite", "minimal"])
      .optional().default("incremental").describe("Implementation approach"),
    testType: z.enum(["unit", "integration", "e2e"])
      .optional().default("unit").describe("Type of tests to generate")
  }),

  "bug-hunt": z.object({
    symptoms: z.string().describe("Description of the problem symptoms"),
    suspected_files: z.array(z.string()).optional()
      .describe("Suspect files to analyze"),
    attachments: z.array(z.string()).optional()
      .describe("Additional files to attach to the analysis (log, dump, etc.)"),
    backendOverrides: z.array(z.string()).optional()
      .describe("Manual override of AI backends"),
    autonomyLevel: z.enum(["LOW", "MEDIUM", "HIGH", "AUTONOMOUS"]).optional()
  }),
  "triangulated-review": z.object({
    files: z.array(z.string()).describe("Files to analyze"),
    goal: z.enum(["bugfix", "refactor"]).optional().default("refactor")
      .describe("Main objective of the review"),
    autonomyLevel: z.enum(["read-only", "low", "medium", "high"])
      .optional()
  }),
  "auto-remediation": z.object({
    symptoms: z.string().describe("Description of the bug to fix"),
    maxActions: z.number().int().min(1).max(10).optional()
      .describe("Maximum number of steps in the plan"),
    autonomyLevel: z.enum(["read-only", "low", "medium", "high"]).optional()
  }),
  "refactor-sprint": z.object({
    targetFiles: z.array(z.string()).describe("Files to refactor"),
    scope: z.string().describe("Description of the scope"),
    depth: z.enum(["light", "balanced", "deep"]).optional().default("balanced"),
    autonomyLevel: z.enum(["read-only", "low", "medium", "high"]).optional()
  }),
  "overthinker": z.object({
    initialPrompt: z.string().describe("The initial raw idea or request from the user"),
    iterations: z.number().int().min(1).max(10).default(3).optional()
      .describe("Number of review/refinement iterations (default: 3)"),
    contextFiles: z.array(z.string()).optional()
      .describe("List of file paths to provide as context"),
    outputFile: z.string().optional().default("overthinking.md")
      .describe("Filename for the final output"),
    modelOverride: z.string().optional()
      .describe("Specific model/backend to use for all steps (default: auto)")
  })
};

/**
 * Initializes the workflow registry
 * This function will be called after importing all workflows
 */
export function initializeWorkflowRegistry(): void {
  if (workflowsInitialized) {
    return;
  }
  workflowsInitialized = true;
  // Workflows will be registered here when implemented
  registerWorkflow("parallel-review", parallelReviewWorkflow);
  registerWorkflow("pre-commit-validate", preCommitValidateWorkflow);
  registerWorkflow("init-session", initSessionWorkflow);
  registerWorkflow("validate-last-commit", validateLastCommitWorkflow);
  registerWorkflow("feature-design", featureDesignWorkflow);
  registerWorkflow("bug-hunt", bugHuntWorkflow);
  registerWorkflow("triangulated-review", triangulatedReviewWorkflow);
  registerWorkflow("auto-remediation", autoRemediationWorkflow);
  registerWorkflow("refactor-sprint", refactorSprintWorkflow);
  registerWorkflow("overthinker", overthinkerWorkflow);

  // Removed console.log - corrupts MCP JSON protocol
  // Use logger.debug() if logging needed
}

/**
 * Ottiene lo schema Zod per un workflow specifico
 */
export function getWorkflowSchema(workflowName: string): z.ZodSchema | undefined {
  ensureWorkflowsInitialized();
  return workflowSchemas[workflowName as keyof typeof workflowSchemas];
}

// Re-export workflow execution functions for barrel export pattern
export { executeParallelReview } from './parallel-review.workflow.js';
export { executePreCommitValidate } from './pre-commit-validate.workflow.js';
export { executeInitSession } from './init-session.workflow.js';
export { executeValidateLastCommit } from './validate-last-commit.workflow.js';
export { executeFeatureDesign } from './feature-design.workflow.js';
export { executeBugHunt } from './bug-hunt.workflow.js';
export { executeTriangulatedReview } from './triangulated-review.workflow.js';
export { executeAutoRemediation } from './auto-remediation.workflow.js';
export { executeRefactorSprint } from './refactor-sprint.workflow.js';
export { executeOverthinker } from './overthinker.workflow.js';

// Re-export workflow definitions
export { parallelReviewWorkflow, preCommitValidateWorkflow, initSessionWorkflow, validateLastCommitWorkflow, featureDesignWorkflow, bugHuntWorkflow, triangulatedReviewWorkflow, autoRemediationWorkflow, refactorSprintWorkflow, overthinkerWorkflow };

// Re-export utility functions
export { runParallelAnalysis, buildCodeReviewPrompt, formatWorkflowOutput } from './utils.js';
