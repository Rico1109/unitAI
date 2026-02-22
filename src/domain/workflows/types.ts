import { z } from "zod";
import { AutonomyLevel } from "../../utils/security/permissionManager.js";

/**
 * Structured progress event. Use with formatProgress() to build
 * consistent, parseable messages for the ProgressCallback.
 */
export interface ProgressEvent {
  /** Workflow or phase name, e.g. "Phase 1/Prompt Refiner" */
  step: string;
  /** Lifecycle position of this event */
  status: 'start' | 'progress' | 'complete' | 'error';
  /** Human-readable detail */
  message?: string;
  /** Optional machine-readable metadata for future consumers */
  data?: Record<string, unknown>;
}

/**
 * Formats a ProgressEvent into the string expected by ProgressCallback.
 * Centralises the message format so all workflows emit consistent output.
 *
 * @example
 *   onProgress?.(formatProgress({ step: 'Phase 1', status: 'start' }));
 *   // → "[start] Phase 1"
 *   onProgress?.(formatProgress({ step: 'Phase 1', status: 'complete', message: 'done' }));
 *   // → "[complete] Phase 1: done"
 */
export function formatProgress(event: ProgressEvent): string {
  const base = `[${event.status}] ${event.step}`;
  return event.message ? `${base}: ${event.message}` : base;
}

/**
 * Callback type for execution progress reporting.
 * Pass the result of formatProgress() for structured, consistent messages.
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
