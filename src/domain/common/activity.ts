/**
 * Common Activity Types
 *
 * Shared types for activity tracking across the system.
 * These types are used by both services and repositories.
 *
 * @module domain/common/activity
 */

/**
 * MCP Server activity record
 */
export interface MCPActivity {
  id: string;
  timestamp: Date;
  activityType: 'tool_invocation' | 'workflow_execution' | 'agent_action';
  toolName?: string;
  workflowName?: string;
  agentName?: string;
  duration?: number;
  success: boolean;
  errorMessage?: string;
  metadata: Record<string, any>;
}
