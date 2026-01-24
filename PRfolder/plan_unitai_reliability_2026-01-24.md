---
title: Reliability Remediation Plan
version: 1.0.0
updated: 2026-01-24T19:15:00+01:00
scope: unitai-reliability
category: plan
subcategory: reliability
status: draft
domain: [reliability, graceful-shutdown, state-persistence, error-recovery]
related_issues: [REL-001, REL-002, REL-003, REL-004, REL-005, REL-006, REL-007, REL-008, REL-009, REL-010, REL-011, REL-012]
audit_source: Manual review - 2026-01-24
changelog:
  - 1.0.0 (2026-01-24): Initial plan consolidating reliability audit findings.
---

# Reliability Remediation Plan

## Executive Summary

**Issues**: 12 (4 Critical, 5 High, 3 Medium)  
**Estimated Effort**: 5-7 days  
**Production Ready After**: Phase 1 + Phase 2

---

## Phase 1: Critical Fixes (Days 1-3)

### REL-001: Graceful Shutdown

**File**: `src/server.ts`

**Implementation**:
1. Add `setupShutdownHandlers()` method
2. Register SIGINT/SIGTERM handlers
3. Add 10s grace period timeout
4. Persist state before exit

```typescript
private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}, initiating graceful shutdown...`);
        
        const shutdownTimeout = setTimeout(() => {
            logger.warn("Shutdown timeout exceeded, forcing exit");
            process.exit(1);
        }, 10000);

        try {
            await this.stop();
            clearTimeout(shutdownTimeout);
            process.exit(0);
        } catch (error) {
            logger.error("Error during shutdown", error);
            process.exit(1);
        }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
```

**Tasks**:
- [ ] Add `setupShutdownHandlers()` method
- [ ] Call it at end of `start()`
- [ ] Update `stop()` to persist volatile state

---

### REL-002: Circuit Breaker Persistence

**File**: `src/utils/circuitBreaker.ts`

**Implementation**:
1. Add `loadState()` on construction
2. Add `persistState()` after transitions
3. Add `shutdown()` for graceful save
4. Store in `data/circuit-breaker-state.json`

**Tasks**:
- [ ] Add state file path constant
- [ ] Implement `loadState()` with age validation
- [ ] Implement `persistState()` async
- [ ] Call persist after `transitionTo()`
- [ ] Export `shutdown()` method
- [ ] Call from server shutdown

---

### REL-003: Backend Stats Persistence

**File**: `src/workflows/modelSelector.ts`

**Implementation**:
1. Add SQLite table for metrics
2. Load on construction
3. Persist after `recordCall()`
4. Add `shutdown()` method

**Tasks**:
- [ ] Create `backend_metrics` table in `initDb()`
- [ ] Implement `loadStats()`
- [ ] Implement `persistStat()` with INSERT OR REPLACE
- [ ] Export `shutdown()` for cleanup

---

### REL-004: Safe Database Close

**File**: `src/dependencies.ts`

**Implementation**:
1. Close all DBs independently (don't fail fast)
2. Run WAL checkpoint before close
3. Collect errors, throw after all attempts
4. Log each close operation

```typescript
export function closeDependencies(): void {
    if (!dependencies) return;

    const errors: Error[] = [];
    const dbs = [
        { name: 'activityDb', db: dependencies.activityDb },
        { name: 'auditDb', db: dependencies.auditDb },
        { name: 'tokenDb', db: dependencies.tokenDb }
    ];

    for (const { name, db } of dbs) {
        try {
            if (db.open) {
                db.pragma('wal_checkpoint(TRUNCATE)');
                db.close();
            }
        } catch (error) {
            errors.push(error);
            logger.error(`Failed to close ${name}`, error);
        }
    }

    dependencies = null;
    if (errors.length > 0) {
        throw new Error(`Failed to close ${errors.length} database(s)`);
    }
}
```

**Tasks**:
- [ ] Refactor `closeDependencies()` with error collection
- [ ] Add WAL checkpoint before close
- [ ] Log each close operation

---

## Phase 2: High Priority Fixes (Days 4-5)

### REL-005: Retry Logic

**File**: `src/utils/aiExecutor.ts`

**Implementation**:
1. Create `executeWithRetry<T>()` helper
2. Exponential backoff (1s, 2s, 4s)
3. Max 3 attempts
4. Wrap AI executor calls

**Tasks**:
- [ ] Add `RetryConfig` interface
- [ ] Implement `executeWithRetry()`
- [ ] Add `sleep()` utility
- [ ] Wrap each executor function

---

### REL-006: Backend-Specific Timeouts

**File**: `src/utils/aiExecutor.ts`

**Implementation**:
```typescript
const BACKEND_TIMEOUTS: Record<string, number> = {
  gemini: 20 * 60 * 1000,    // 20 min
  droid: 15 * 60 * 1000,     // 15 min
  qwen: 5 * 60 * 1000,       // 5 min
  'cursor-agent': 10 * 60 * 1000,
  rovodev: 10 * 60 * 1000
};
```

**Tasks**:
- [ ] Add `BACKEND_TIMEOUTS` constant
- [ ] Update each executor to use it

---

### REL-008: Memory Leak Prevention

**Files**: `circuitBreaker.ts`, `modelSelector.ts`

**Implementation**:
1. Add MAX_BACKENDS constant (50)
2. Add cleanup when exceeding limit
3. Evict oldest 10% when full

**Tasks**:
- [ ] Add MAX_BACKENDS constant
- [ ] Add `cleanupOldEntries()` method
- [ ] Call after adding new entries

---

### REL-009: Safe Progress Callback

**File**: `src/utils/aiExecutor.ts`

**Implementation**:
```typescript
function safeOnProgress(
    callback: ((msg: string) => void) | undefined, 
    msg: string
): void {
    if (!callback) return;
    try {
        callback(msg);
    } catch (error) {
        logger.warn('onProgress callback threw error', { msg, error });
    }
}
```

**Tasks**:
- [ ] Add `safeOnProgress()` utility
- [ ] Replace all `onProgress?.()` calls

---

## Phase 3: Medium Priority (Days 6-7)

### REL-007: Connection Pooling (Optional)

For SQLite with WAL mode, single writer is often fine. Consider only if:
- High read volume observed
- Performance issues measured

### REL-010: Audit Error Logging

- Replace `console.warn` with `logger.error`
- Add fallback file-based audit

### REL-011: DB Circuit Breaker (Optional)

- Add health check for DB operations
- Fail fast if DB repeatedly errors

### REL-012: Health Endpoint

- Add `/health` endpoint (if HTTP added)
- Return status of all components

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/server.ts` | Shutdown handlers, state persistence |
| `src/dependencies.ts` | Safe close with error collection |
| `src/utils/circuitBreaker.ts` | State persistence, shutdown |
| `src/workflows/modelSelector.ts` | Stats persistence, cleanup |
| `src/utils/aiExecutor.ts` | Retry, timeouts, safe callbacks |

---

## Verification

### Automated Tests

```bash
# Run existing tests
npm test

# Run reliability-specific tests (to be added)
npm test -- --grep "reliability"
```

### Manual Verification

1. **Graceful Shutdown**:
   ```bash
   npm start &
   sleep 2
   kill -SIGINT $!
   # Should see "Received SIGINT, initiating graceful shutdown..."
   ```

2. **State Persistence**:
   ```bash
   # Make backend fail 3 times
   # Restart server
   # Check circuit breaker still OPEN
   cat data/circuit-breaker-state.json
   ```

3. **Database Close**:
   ```bash
   # Check no WAL files after clean shutdown
   ls -la data/*.sqlite-wal
   # Should be empty or small
   ```

---

## Related Documents

- `ssot_unitai_architecture_2026-01-24.md` - Architecture
- `ssot_unitai_reliability_audit_2026-01-24.md` - Detailed audit (this plan consolidates it)
- `plan_unitai_security_2026-01-24.md` - Security fixes (completed)
