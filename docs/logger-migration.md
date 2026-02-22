# Logger Migration Guide

## Overview

The unitAI logger has been unified to provide both console output AND structured JSON logging to files. All logs now automatically go to:
- **Console (stderr)** - for real-time debugging
- **Log files** - for post-mortem analysis and monitoring

## Quick Start

No changes required! Your existing code continues to work:

```typescript
import { logger } from './utils/logger.js';

logger.info('Processing started');
logger.error('Something went wrong', error);
logger.debug('Detailed trace info');
```

## What Changed

### Before (Old logger.ts)
- Console-only logging
- No persistence
- No structured data
- Hard to query or analyze

### After (Unified logger)
- Console output **preserved** (no breaking changes)
- Automatic file-based logging with rotation
- JSON structured logs with categories and metadata
- Queryable log data for debugging

## Migration Path

### Using Legacy Logger (Backward Compatible)

The old API still works exactly as before:

```typescript
import { logger } from './utils/logger.js';

logger.info('User logged in', { userId: 123 });
logger.error('Database error', error);
logger.progress('Processing file 1 of 10');
```

**Behind the scenes**, logs now go to:
- Console: `[UAI-MCP] [INFO] User logged in { userId: 123 }`
- File: `logs/system.log` (JSON format)

### Using New Structured Logger (Recommended for New Code)

For new code, use the structured logger directly:

```typescript
import { structuredLogger, LogCategory } from './utils/structuredLogger.js';

// Basic logging
structuredLogger.info(
  LogCategory.SYSTEM,
  'authentication',
  'login',
  'User logged in successfully',
  { userId: 123, ip: '192.168.1.1' }
);

// Workflow-scoped logging
const logger = structuredLogger.forWorkflow('wf-123', 'parallel-review');
logger.step('backend-selection', 'Selected 3 backends');
logger.aiCall('ask-gemini', prompt);
logger.timing('analysis', async () => {
  // Automatically tracks duration
  return await performAnalysis();
});
```

## Log Files

Logs are written to the `logs/` directory:

| File | Content |
|------|---------|
| `system.log` | General system logs (LogCategory.SYSTEM) |
| `workflow.log` | Workflow execution logs |
| `ai-backend.log` | AI backend calls (Gemini, Cursor, Droid) |
| `permission.log` | Permission checks and approvals |
| `errors.log` | All error-level logs |
| `debug.log` | All logs (debug, info, warn, error) |

## Querying Logs

```typescript
import { structuredLogger } from './utils/structuredLogger.js';

// Query logs for a specific workflow
const logs = structuredLogger.queryLogs({
  workflowId: 'wf-abc-123',
  category: LogCategory.WORKFLOW,
  startTime: new Date('2025-01-01'),
  limit: 100
});

console.log(`Found ${logs.length} logs`);
logs.forEach(log => {
  console.log(`[${log.timestamp}] ${log.component}/${log.operation}: ${log.message}`);
});

// Export logs for external analysis
const csv = structuredLogger.exportLogs(LogCategory.WORKFLOW, 'csv');
fs.writeFileSync('workflow-logs.csv', csv);
```

## Advanced Features

### Workflow Logger with Span Tracking

```typescript
const workflowLogger = structuredLogger.forWorkflow('wf-123', 'parallel-review');

// Create child logger for nested operations
const childLogger = workflowLogger.child('gemini-analysis');
childLogger.step('start', 'Starting Gemini analysis');

// Child logs reference parent via parentSpanId
// Enables distributed tracing visualization
```

### Request ID Tracking

```typescript
// Tools now receive requestId automatically
export const myTool: UnifiedTool = {
  name: 'my-tool',
  execute: async (args, context) => {
    const { requestId, onProgress } = context;

    logger.info(`Executing tool [requestId: ${requestId}]`);
    // requestId propagates through workflows and AI backends
  }
};
```

### RED Metrics

```typescript
// Automatically tracked for:
// - AI backend calls (executeAIClient)
// - Workflow operations (WorkflowLogger.timing)

// View metrics via MCP tool
// Call: red-metrics-dashboard
{
  component: "ai-executor",
  backend: "ask-gemini",
  timeRangeMinutes: 60
}

// Output:
// Rate: 2.5 req/s
// Error rate: 1.2%
// P50: 350ms, P95: 800ms, P99: 1200ms
```

## Log Rotation

Logs automatically rotate when they reach 10MB (configurable):

```typescript
const logger = new StructuredLogger({
  logDir: './logs',
  maxFileSizeMB: 10  // Default
});
```

Rotated files are renamed: `system.log.2025-01-26T10-30-00.old`

## Cleanup

Remove old logs:

```typescript
// Delete logs older than 30 days
structuredLogger.cleanup(30);
```

## Examples

### Old Code (Still Works)
```typescript
import { logger } from './utils/logger.js';

export async function processPayment(amount: number) {
  logger.info('Processing payment', { amount });
  try {
    const result = await chargeCard(amount);
    logger.info('Payment successful');
    return result;
  } catch (error) {
    logger.error('Payment failed', error);
    throw error;
  }
}
```

### New Code (Recommended)
```typescript
import { structuredLogger, LogCategory } from './utils/structuredLogger.js';

export async function processPayment(
  amount: number,
  workflowId: string
) {
  const logger = structuredLogger.forWorkflow(workflowId, 'payment-processor');

  logger.step('start', 'Processing payment', { amount });

  return await logger.timing('charge-card', async () => {
    try {
      const result = await chargeCard(amount);
      logger.step('success', 'Payment successful', { transactionId: result.id });
      return result;
    } catch (error) {
      logger.error('charge-card', error as Error);
      throw error;
    }
  });
}
```

## Troubleshooting

### Issue: "Cannot find module './legacyLogger.js'"

**Cause**: Missing build step

**Fix**:
```bash
npm run build
```

### Issue: Logs not appearing in files

**Cause**: Log directory doesn't exist or permissions issue

**Fix**:
```bash
mkdir -p logs
chmod 755 logs
```

### Issue: "Database is locked" error

**Cause**: Multiple server instances writing to same log files

**Fix**: Each server instance should use a separate log directory
```typescript
const logger = new StructuredLogger({
  logDir: `./logs/instance-${process.pid}`
});
```

## Best Practices

1. **Use workflow loggers** for any multi-step operation
2. **Include metadata** for searchability
3. **Use proper categories** (SYSTEM, WORKFLOW, AI_BACKEND, etc.)
4. **Leverage timing()** for automatic duration tracking
5. **Query logs** for debugging instead of adding more console.logs

## Performance

- Log writes are **non-blocking** (WriteStream with flags: 'a')
- Automatic rotation prevents disk space issues
- Component detection is cached
- Minimal overhead on critical paths

## Summary

| Feature | Old Logger | New Logger |
|---------|-----------|------------|
| Console output | ✅ | ✅ (preserved) |
| File persistence | ❌ | ✅ JSON + rotation |
| Structured data | ❌ | ✅ Categories, metadata |
| Queryable | ❌ | ✅ In-memory + file search |
| Span tracking | ❌ | ✅ Parent/child relationships |
| Request IDs | ❌ | ✅ End-to-end tracing |
| RED metrics | ❌ | ✅ Rate, Errors, Duration |
| Breaking changes | N/A | ❌ None! |

## Next Steps

- Explore log files in `logs/` directory
- Try querying logs with `structuredLogger.queryLogs()`
- Use RED metrics dashboard: `red-metrics-dashboard`
- Read SSOT documentation: `unitAI/PRfolder/ssot_unitai_observability_2026-01-25.md`
