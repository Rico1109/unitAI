import { z } from "zod";
import { MetricsRepository } from "../repositories/metrics.js";
import { getDependencies } from "../dependencies.js";
import type { UnifiedTool, ToolExecutionContext } from "./registry.js";

/**
 * RED Metrics Dashboard Tool
 *
 * Displays Rate, Errors, Duration metrics for:
 * - AI backend calls (gemini, cursor, droid, etc.)
 * - Workflow operations
 * - Overall system health
 */

const redMetricsSchema = z.object({
  component: z.string().optional().describe("Filter by component name (e.g., 'ai-executor', 'parallel-review')"),
  backend: z.string().optional().describe("Filter by AI backend (e.g., 'ask-gemini', 'ask-cursor')"),
  timeRangeMinutes: z.number().optional().default(60).describe("Time range in minutes (default: 60)")
});

export const redMetricsDashboardTool: UnifiedTool = {
  name: 'red-metrics-dashboard',
  description: 'Display RED (Rate, Errors, Duration) metrics for AI backends and workflows',
  zodSchema: redMetricsSchema,

  execute: async (args: Record<string, any>, context: ToolExecutionContext) => {
    const { component, backend, timeRangeMinutes } = args;
    const { requestId } = context;

    const { metricsDb } = getDependencies();
    const metricsRepo = new MetricsRepository(metricsDb);

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeRangeMinutes * 60 * 1000);

    const stats = metricsRepo.getREDStats({ component, backend, startTime, endTime });
    const errorBreakdown = metricsRepo.getErrorBreakdown({ component, backend, startTime, endTime });

    // Build dashboard output
    const filterInfo = [];
    if (component) filterInfo.push(`Component: ${component}`);
    if (backend) filterInfo.push(`Backend: ${backend}`);
    const filters = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : '';

    let output = `📊 RED Metrics Dashboard${filters}
Time Range: Last ${timeRangeMinutes} minutes (${startTime.toISOString()} to ${endTime.toISOString()})

📈 RATE (Throughput):
  • Requests/second: ${stats.rate.toFixed(3)} req/s
  • Total requests: ${stats.totalRequests}

❌ ERRORS (Reliability):
  • Error rate: ${stats.errorRate.toFixed(2)}%
  • Successful: ${Math.round(stats.totalRequests * (1 - stats.errorRate / 100))}
  • Failed: ${Math.round(stats.totalRequests * (stats.errorRate / 100))}

⏱️  DURATION (Latency):
  • P50 (median): ${stats.p50}ms
  • P95: ${stats.p95}ms
  • P99: ${stats.p99}ms
`;

    if (errorBreakdown.length > 0) {
      output += `\n🔍 ERROR BREAKDOWN:\n`;
      errorBreakdown.forEach(({ errorType, count }) => {
        output += `  • ${errorType}: ${count} occurrences\n`;
      });
    }

    if (stats.totalRequests === 0) {
      output += `\n⚠️  No metrics found in the specified time range.`;
    }

    output += `\n[requestId: ${requestId}]`;

    return output;
  },

  metadata: {
    category: 'observability',
    bestFor: ['monitoring system health', 'debugging performance issues', 'tracking error rates'],
    cost: 'low',
    duration: '< 1s'
  }
};
