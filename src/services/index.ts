// Public API exports for services
export { ActivityAnalytics, getActivityAnalytics } from './activityAnalytics.js';
export { executeAIClient, executeSimpleCommand, transformOptionsForBackend } from './ai-executor.js';
export { logAudit, getAuditTrail, AuditTrail } from './audit-trail.js';
export { StructuredLogger, structuredLogger } from './structured-logger.js';
export { TokenSavingsMetrics, estimateFileTokens, estimateToolOutput, suggestOptimalTool } from './token-estimator.js';

// Export types
export type { AIExecutionOptions } from './ai-executor.js';
export type { TimeRange, ToolUsageStats, WorkflowStats, UserActivitySummary } from './activityAnalytics.js';
export type { AuditEntry, AuditStats } from './audit-trail.js';
export type { TokenSavingsStats } from './token-estimator.js';
