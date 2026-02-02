/**
 * Activity Analytics Service
 *
 * Aggregates and analyzes user activity data from multiple sources:
 * - Audit trail (autonomous operations)
 * - Token metrics (tool usage efficiency)
 * - Workflow executions
 * - Agent performance
 */
import { AuditTrail, AuditStats } from '../utils/auditTrail.js';
import { TokenSavingsMetrics, TokenSavingsStats } from '../utils/tokenEstimator.js';
import { ActivityRepository } from '../repositories/activity.js';
import { MCPActivity } from '../domain/common/activity.js';
/**
 * Time range for activity queries
 */
export interface TimeRange {
    startTime: Date;
    endTime: Date;
}
/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
    toolName: string;
    invocations: number;
    successRate: number;
    avgResponseTime?: number;
    lastUsed: Date;
}
/**
 * Workflow execution statistics
 */
export interface WorkflowStats {
    workflowName: string;
    executions: number;
    successCount: number;
    failureCount: number;
    avgDuration?: number;
    lastExecuted: Date;
}
/**
 * User activity summary
 */
export interface UserActivitySummary {
    period: string;
    totalOperations: number;
    toolInvocations: number;
    workflowExecutions: number;
    tokensSaved: number;
    successRate: number;
    topTools: ToolUsageStats[];
    topWorkflows: WorkflowStats[];
    auditStats: AuditStats;
    tokenStats: TokenSavingsStats;
    activityByHour: {
        hour: number;
        count: number;
    }[];
    activityByDay: {
        date: string;
        count: number;
    }[];
}
/**
 * Activity Analytics Service
 *
 * Provides comprehensive analytics across all MCP server activities
 */
export declare class ActivityAnalytics {
    private auditTrail;
    private tokenMetrics;
    private repository;
    constructor(repository: ActivityRepository, auditTrail: AuditTrail, tokenMetrics: TokenSavingsMetrics);
    /**
     * Record an MCP activity
     */
    recordActivity(activity: Omit<MCPActivity, 'id' | 'timestamp'>): string;
    /**
     * Query MCP activities
     */
    queryActivities(filters?: {
        activityType?: string;
        toolName?: string;
        workflowName?: string;
        startTime?: Date;
        endTime?: Date;
        success?: boolean;
        limit?: number;
    }): MCPActivity[];
    /**
     * Get comprehensive user activity summary
     */
    getActivitySummary(days?: number): UserActivitySummary;
    /**
     * Calculate activity distribution by hour of day
     */
    private calculateActivityByHour;
    /**
     * Calculate activity distribution by day
     */
    private calculateActivityByDay;
    /**
     * Get tool usage statistics for a specific tool
     */
    getToolStats(toolName: string, days?: number): ToolUsageStats | null;
    /**
     * Get workflow execution statistics
     */
    getWorkflowStats(workflowName: string, days?: number): WorkflowStats | null;
    /**
     * Get real-time activity feed
     */
    getRecentActivities(limit?: number): MCPActivity[];
    /**
     * Cleanup old activity records
     */
    cleanup(daysToKeep?: number): number;
    /**
     * Close all database connections
     */
    close(): void;
    /**
     * Generate unique ID for activity
     */
    private generateId;
}
/**
 * Get or create the global analytics instance
 * Note: This relies on dependencies being initialized earlier in the lifecycle
 */
export declare function getActivityAnalytics(): ActivityAnalytics;
//# sourceMappingURL=activityAnalytics.d.ts.map