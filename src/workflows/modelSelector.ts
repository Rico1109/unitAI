/**
 * Smart Model Selection
 * 
 * Rule-based system for selecting the optimal AI backend based on task characteristics.
 * Simpler and more pragmatic than meta-orchestration approaches.
 */

import { BACKENDS } from '../utils/aiExecutor.js';
import { logAudit } from '../utils/auditTrail.js';

export interface TaskCharacteristics {
  complexity: 'low' | 'medium' | 'high';
  tokenBudget: number;
  requiresArchitecturalThinking: boolean;
  requiresCodeGeneration: boolean;
  requiresSpeed: boolean;
  requiresCreativity: boolean;
  domain?: 'security' | 'performance' | 'architecture' | 'debugging' | 'general';
}

export interface BackendMetrics {
  backend: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgResponseTime: number;
  lastUsed: Date;
}

/**
 * Backend selection statistics
 */
class BackendStats {
  private stats = new Map<string, BackendMetrics>();

  /**
   * Record a backend call
   */
  recordCall(backend: string, success: boolean, responseTimeMs: number): void {
    const current = this.stats.get(backend) || {
      backend,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      avgResponseTime: 0,
      lastUsed: new Date()
    };

    current.totalCalls++;
    if (success) {
      current.successfulCalls++;
    } else {
      current.failedCalls++;
    }

    // Update average response time
    current.avgResponseTime = 
      (current.avgResponseTime * (current.totalCalls - 1) + responseTimeMs) / current.totalCalls;
    
    current.lastUsed = new Date();
    this.stats.set(backend, current);
  }

  /**
   * Get statistics for a backend
   */
  getStats(backend: string): BackendMetrics | undefined {
    return this.stats.get(backend);
  }

  /**
   * Get all statistics
   */
  getAllStats(): BackendMetrics[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get success rate for a backend
   */
  getSuccessRate(backend: string): number {
    const stats = this.stats.get(backend);
    if (!stats || stats.totalCalls === 0) return 1.0; // Assume good if unknown
    return stats.successfulCalls / stats.totalCalls;
  }
}

/**
 * Global backend statistics
 */
const backendStats = new BackendStats();

/**
 * Select optimal backend based on task characteristics
 */
export function selectOptimalBackend(
  task: TaskCharacteristics,
  allowedBackends?: string[]
): string {
  const available = allowedBackends || [BACKENDS.QWEN, BACKENDS.GEMINI, BACKENDS.ROVODEV];

  // Rule 1: Speed is critical + low complexity = Qwen
  if (task.requiresSpeed && task.complexity === 'low' && available.includes(BACKENDS.QWEN)) {
    return BACKENDS.QWEN;
  }

  // Rule 2: Architectural thinking = Gemini
  if (task.requiresArchitecturalThinking && available.includes(BACKENDS.GEMINI)) {
    return BACKENDS.GEMINI;
  }

  // Rule 3: Code generation + high complexity = Rovodev
  if (task.requiresCodeGeneration && task.complexity === 'high' && available.includes(BACKENDS.ROVODEV)) {
    return BACKENDS.ROVODEV;
  }

  // Rule 4: Domain-specific selection
  if (task.domain) {
    switch (task.domain) {
      case 'security':
        // Qwen is fast for pattern matching (secrets, vulnerabilities)
        if (available.includes(BACKENDS.QWEN)) return BACKENDS.QWEN;
        break;
      
      case 'architecture':
        // Gemini excels at high-level design
        if (available.includes(BACKENDS.GEMINI)) return BACKENDS.GEMINI;
        break;
      
      case 'debugging':
        // Rovodev is practical for bug fixes
        if (available.includes(BACKENDS.ROVODEV)) return BACKENDS.ROVODEV;
        break;
      
      case 'performance':
        // Gemini for analysis, Rovodev for optimization
        if (task.requiresCodeGeneration && available.includes(BACKENDS.ROVODEV)) {
          return BACKENDS.ROVODEV;
        }
        if (available.includes(BACKENDS.GEMINI)) return BACKENDS.GEMINI;
        break;
    }
  }

  // Rule 5: Token budget considerations
  if (task.tokenBudget < 10000 && available.includes(BACKENDS.QWEN)) {
    // Use cheaper model for limited budgets
    return BACKENDS.QWEN;
  }

  // Rule 6: High complexity general task = Gemini
  if (task.complexity === 'high' && available.includes(BACKENDS.GEMINI)) {
    return BACKENDS.GEMINI;
  }

  // Rule 7: Consider success rates
  const rankedBySuccess = available
    .map(backend => ({
      backend,
      successRate: backendStats.getSuccessRate(backend)
    }))
    .sort((a, b) => b.successRate - a.successRate);

  if (rankedBySuccess.length > 0 && rankedBySuccess[0].successRate > 0.7) {
    return rankedBySuccess[0].backend;
  }

  // Default: Gemini (best balance)
  return available.includes(BACKENDS.GEMINI) ? BACKENDS.GEMINI : available[0];
}

/**
 * Select multiple backends for parallel analysis
 */
export function selectParallelBackends(
  task: TaskCharacteristics,
  count: number = 2
): string[] {
  const selections: string[] = [];
  const available = [BACKENDS.QWEN, BACKENDS.GEMINI, BACKENDS.ROVODEV];

  // Strategy: diversify for different strengths
  if (count >= 1) {
    // First choice: optimal backend
    const primary = selectOptimalBackend(task, available);
    selections.push(primary);
  }

  if (count >= 2 && selections.length < count) {
    // Second choice: complementary backend
    const remaining = available.filter(b => !selections.includes(b));
    
    if (selections[0] === BACKENDS.GEMINI) {
      // Complement Gemini with practical Rovodev
      selections.push(remaining.includes(BACKENDS.ROVODEV) ? BACKENDS.ROVODEV : remaining[0]);
    } else if (selections[0] === BACKENDS.QWEN) {
      // Complement Qwen with deep-thinking Gemini
      selections.push(remaining.includes(BACKENDS.GEMINI) ? BACKENDS.GEMINI : remaining[0]);
    } else {
      // Complement Rovodev with analytical Gemini
      selections.push(remaining.includes(BACKENDS.GEMINI) ? BACKENDS.GEMINI : remaining[0]);
    }
  }

  if (count >= 3 && selections.length < count) {
    // Third choice: remaining backend
    const remaining = available.filter(b => !selections.includes(b));
    if (remaining.length > 0) {
      selections.push(remaining[0]);
    }
  }

  return selections.slice(0, count);
}

/**
 * Record backend usage for learning
 */
export function recordBackendUsage(
  backend: string,
  task: TaskCharacteristics,
  success: boolean,
  responseTimeMs: number
): void {
  backendStats.recordCall(backend, success, responseTimeMs);

  // Audit log
  logAudit({
    operation: 'backend-selection',
    autonomyLevel: 'MEDIUM',
    details: `Backend: ${backend}, Success: ${success}, Time: ${responseTimeMs}ms, Task: ${JSON.stringify(task)}`
  }).catch(err => console.warn('Failed to log backend usage:', err));
}

/**
 * Get backend statistics
 */
export function getBackendStats(): BackendMetrics[] {
  return backendStats.getAllStats();
}

/**
 * Get recommendations for backend selection
 */
export function getBackendRecommendations(): string {
  const stats = backendStats.getAllStats();
  
  if (stats.length === 0) {
    return 'No backend usage data available yet.';
  }

  const sorted = stats.sort((a, b) => b.successfulCalls - a.successfulCalls);
  
  let report = '# Backend Usage Statistics\n\n';
  
  for (const stat of sorted) {
    const successRate = (stat.successfulCalls / stat.totalCalls * 100).toFixed(1);
    report += `## ${stat.backend}\n`;
    report += `- Total Calls: ${stat.totalCalls}\n`;
    report += `- Success Rate: ${successRate}%\n`;
    report += `- Avg Response Time: ${stat.avgResponseTime.toFixed(0)}ms\n`;
    report += `- Last Used: ${stat.lastUsed.toISOString()}\n\n`;
  }

  return report;
}

/**
 * Helper to create task characteristics from workflow context
 */
export function createTaskCharacteristics(
  workflowName: string,
  customOverrides?: Partial<TaskCharacteristics>
): TaskCharacteristics {
  // Default characteristics based on workflow
  const defaults: Record<string, TaskCharacteristics> = {
    'parallel-review': {
      complexity: 'high',
      tokenBudget: 50000,
      requiresArchitecturalThinking: true,
      requiresCodeGeneration: false,
      requiresSpeed: false,
      requiresCreativity: false,
      domain: 'architecture'
    },
    'pre-commit-validate': {
      complexity: 'medium',
      tokenBudget: 30000,
      requiresArchitecturalThinking: false,
      requiresCodeGeneration: false,
      requiresSpeed: true,
      requiresCreativity: false,
      domain: 'security'
    },
    'bug-hunt': {
      complexity: 'high',
      tokenBudget: 40000,
      requiresArchitecturalThinking: false,
      requiresCodeGeneration: false,
      requiresSpeed: false,
      requiresCreativity: false,
      domain: 'debugging'
    },
    'feature-design': {
      complexity: 'high',
      tokenBudget: 60000,
      requiresArchitecturalThinking: true,
      requiresCodeGeneration: true,
      requiresSpeed: false,
      requiresCreativity: true,
      domain: 'architecture'
    },
    'validate-last-commit': {
      complexity: 'medium',
      tokenBudget: 25000,
      requiresArchitecturalThinking: false,
      requiresCodeGeneration: false,
      requiresSpeed: true,
      requiresCreativity: false,
      domain: 'general'
    }
  };

  const base = defaults[workflowName] || {
    complexity: 'medium',
    tokenBudget: 30000,
    requiresArchitecturalThinking: false,
    requiresCodeGeneration: false,
    requiresSpeed: false,
    requiresCreativity: false,
    domain: 'general'
  };

  return { ...base, ...customOverrides };
}
