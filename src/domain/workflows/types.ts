import { z } from "zod";
import { AutonomyLevel } from "../../utils/security/permissionManager.js";

/**
 * Callback type for execution progress reporting
 */
export type ProgressCallback = (message: string) => void;

/**
 * Base parameters for all workflows
 * Includes autonomy level for the permission system
 */
export interface BaseWorkflowParams {
  /**
   * Autonomy level for workflow operations.
   * Use "auto" to let unitAI resolve the minimum required level for the workflow.
   * @default "auto"
   */
  autonomyLevel?: AutonomyLevel | 'auto';
  /**
   * Override of AI backends to use during execution
   */
  backendOverrides?: string[];
  /**
   * Attachments to pass to AI tools (for contextual prompts)
   */
  attachments?: string[];
}

/**
 * Base interface for workflow definition
 */
export interface WorkflowDefinition<TParams = any> {
  name: string;
  description: string;
  schema: z.ZodSchema<TParams>;
  execute: (params: TParams, onProgress?: ProgressCallback) => Promise<string>;
}

/**
 * Result of workflow execution
 */
export interface WorkflowResult {
  success: boolean;
  output: string;
  metadata?: Record<string, any>;
}

/**
 * Code analysis focus types
 */
export type ReviewFocus = "architecture" | "security" | "performance" | "quality" | "all";

/**
 * Validation depth levels
 */
export type ValidationDepth = "quick" | "thorough" | "paranoid";

/**
 * Parameters for the parallel-review workflow
 */
export interface ParallelReviewParams extends BaseWorkflowParams {
  files: string[];
  focus?: ReviewFocus;
}

/**
 * Parameters for the pre-commit-validate workflow
 */
export interface PreCommitValidateParams extends BaseWorkflowParams {
  depth: ValidationDepth;
}

/**
 * Parameters for the validate-last-commit workflow
 */
export interface ValidateLastCommitParams extends BaseWorkflowParams {
  commit_ref?: string;
}

/**
 * Parameters for the bug-hunt workflow
 */
export interface BugHuntParams extends BaseWorkflowParams {
  symptoms: string;
  suspected_files?: string[];
}

/**
 * Result of AI analysis
 */
export interface AIAnalysisResult {
  backend: string;
  model?: string;
  output: string;
  success: boolean;
  error?: string;
}

/**
 * Result of parallel analysis
 */
export interface ParallelAnalysisResult {
  results: AIAnalysisResult[];
  synthesis?: string;
}

/**
 * Git repository information
 */
export interface GitRepoInfo {
  currentBranch: string;
  status: string;
  recentCommits: string[];
  stagedFiles: string[];
  modifiedFiles: string[];
}

/**
 * Git commit information
 */
export interface GitCommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  diff: string;
  files: string[];
}
