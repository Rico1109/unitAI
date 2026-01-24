---
title: unitAI Reliability Remediation Plan
version: 1.0.0
updated: 2026-01-24T23:25:00+01:00
scope: unitai-reliability
category: plan
subcategory: implementation
domain: [reliability, graceful-shutdown, state-persistence, di-refactoring]
source: triangulated-review (Gemini + Cursor + Droid)
changelog:
  - 1.0.0 (2026-01-24): Created from triangulated review on 5 core reliability files.
---

# unitAI Reliability Remediation Plan

## Overview

**Source:** Triangulated Review (Gemini + Cursor + Droid) on 2026-01-24
**Files Analyzed:** `server.ts`, `dependencies.ts`, `circuitBreaker.ts`, `modelSelector.ts`, `aiExecutor.ts`
**Target Issues:** REL-001, REL-002, REL-003, REL-004 (Critical), REL-005+ (High/Medium)

All 3 AI backends converged on a **5-step implementation plan** that addresses:
- Graceful shutdown (REL-001)
- Circuit breaker state persistence (REL-002)
- Backend statistics persistence (REL-003)
- Database close error handling (REL-004)

---

## Implementation Phases

### Phase 1: DI Container Enhancement (Steps 1-3)

These steps are foundational - they restructure the codebase to use proper DI, which enables all subsequent reliability improvements.

---

#### Step 1: Migrate Circuit Breaker to DI Container

**Objective:** Replace singleton pattern with dependency injection

**Files to Modify:**
- `src/dependencies.ts` - Add circuitBreaker to AppDependencies
- `src/utils/circuitBreaker.ts` - Remove singleton export, refactor as injectable

**Changes:**

```typescript
// dependencies.ts - Add to AppDependencies interface
export interface AppDependencies {
  activityRepository: ActivityRepository;
  auditDb: Database.Database;
  tokenDb: Database.Database;
  circuitBreaker: CircuitBreaker;  // NEW
}
```

```typescript
// circuitBreaker.ts - Make injectable
export class CircuitBreaker {
  // Remove: private static instance
  // Remove: public static getInstance()
  
  constructor(
    private failureThreshold: number = 3,
    private resetTimeoutMs: number = 300000
  ) {}
  
  // ... rest remains same
}
```

**Verification:**
- [ ] `AppDependencies` includes `circuitBreaker: CircuitBreaker`
- [ ] No `getInstance()` singleton pattern in circuitBreaker.ts
- [ ] All imports of circuitBreaker go through DI

---

#### Step 2: Update modelSelector for DI

**Objective:** Inject `circuitBreaker` and `BackendStats` instead of using globals

**Files to Modify:**
- `src/workflows/modelSelector.ts`

**Changes:**

```typescript
// modelSelector.ts - Functions receive dependencies
export function selectOptimalBackend(
  task: TaskCharacteristics,
  circuitBreaker: CircuitBreaker  // NEW parameter
): string {
  // ... same logic, use passed circuitBreaker
}

export function selectFallbackBackend(
  failedBackend: string,
  circuitBreaker: CircuitBreaker  // NEW parameter
): string {
  // ...
}
```

**Verification:**
- [ ] Functions accept CircuitBreaker as parameter
- [ ] BackendStats instantiated in DI container
- [ ] Tests with simulated OPEN/CLOSED states pass

---

#### Step 3: Update aiExecutor for DI

**Objective:** Pass `CircuitBreaker` via DI instead of direct imports

**Files to Modify:**
- `src/utils/aiExecutor.ts`

**Changes:**

```typescript
// aiExecutor.ts - Accept dependencies
export async function executeAIClient(
  options: AIExecutionOptions,
  deps: { circuitBreaker: CircuitBreaker },  // NEW
  retryConfig?: RetryConfig
): Promise<string> {
  const { circuitBreaker } = deps;
  // Use injected circuitBreaker instead of import
}
```

**Verification:**
- [ ] `executeAIClient()` accepts circuitBreaker from dependencies
- [ ] Retry fallback mechanism still works
- [ ] All workflow calls updated

---

### Phase 2: State Persistence (Step 4)

After DI is in place, we can add persistence without touching many files.

---

#### Step 4: Add Circuit Breaker State Persistence

**Objective:** Save and restore circuit breaker state between restarts

**Files to Modify:**
- `src/utils/circuitBreaker.ts` - Add load/save methods
- `src/dependencies.ts` - Initialize with persisted state

**New Database Table:**

```sql
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  backend TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0,
  last_failure_time INTEGER
);
```

**Changes to CircuitBreaker:**

```typescript
export class CircuitBreaker {
  constructor(
    private db: Database.Database,  // NEW - for persistence
    private failureThreshold: number = 3,
    private resetTimeoutMs: number = 300000
  ) {
    this.loadState();  // Restore on init
  }
  
  private loadState(): void {
    const rows = this.db.prepare(
      'SELECT * FROM circuit_breaker_state'
    ).all() as CircuitStateRow[];
    
    for (const row of rows) {
      this.state.set(row.backend, {
        state: row.state as CircuitState,
        failures: row.failures,
        lastFailureTime: row.last_failure_time
      });
    }
  }
  
  private saveState(backend: string): void {
    const state = this.state.get(backend);
    if (!state) return;
    
    this.db.prepare(`
      INSERT OR REPLACE INTO circuit_breaker_state
      (backend, state, failures, last_failure_time)
      VALUES (?, ?, ?, ?)
    `).run(backend, state.state, state.failures, state.lastFailureTime ?? null);
  }
  
  // Call saveState() in onSuccess(), onFailure(), and state transitions
}
```

**Verification:**
- [ ] Table `circuit_breaker_state` created on init
- [ ] `loadState()` restores state on startup
- [ ] `saveState()` persists every transition
- [ ] `reset-circuit-breaker.ts` cleans DB too

---

### Phase 3: Lifecycle Management (Step 5)

---

#### Step 5: Add Complete Lifecycle with Graceful Shutdown

**Objective:** Guarantee clean shutdown and robust recovery

**Files to Modify:**
- `src/server.ts` - Add signal handlers
- `src/dependencies.ts` - Add shutdown sequence

**Changes to server.ts:**

```typescript
// server.ts
async start(): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info("UnitAI MCP Server started (Stdio)");
    
    this.setupShutdownHandlers();  // NEW
  } catch (error) {
    logger.error("Failed to start server", error);
    await this.stop();
    process.exit(1);
  }
}

private setupShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, initiating graceful shutdown...`);
    
    // Grace period for in-flight requests
    setTimeout(() => {
      logger.warn("Grace period expired, forcing exit");
      process.exit(1);
    }, 10000);
    
    try {
      await this.stop();
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

**Changes to dependencies.ts:**

```typescript
export function closeDependencies(): void {
  if (deps) {
    try {
      deps.circuitBreaker.shutdown();  // Persist final state
    } catch (error) {
      logger.error("Error persisting circuit breaker state", error);
    }
    
    try {
      deps.activityDb?.close();
    } catch (error) {
      logger.error("Error closing activity database", error);
    }
    
    // ... same pattern for other DBs
    
    deps = null;
  }
}
```

**Verification:**
- [ ] SIGINT/SIGTERM handlers registered
- [ ] `stop()` called on signals
- [ ] Circuit breaker state persisted before DB close
- [ ] Errors during close are logged but don't crash

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking changes cascade | Do all DI changes in one commit |
| Existing tests fail | Update tests alongside code |
| Race conditions on persist | Use sync SQLite operations |
| Startup time increase | Measure, optimize if >100ms impact |

---

## Verification Checklist

After implementation:

- [ ] Build passes (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] Server starts and stops cleanly
- [ ] Circuit breaker state survives restart
- [ ] Triangulated review passes on modified files

---

## Related Documents

- `ssot_unitai_reliability_audit_2026-01-24.md` - Original audit findings
- `triangulated_review_reliability_2026-01-24.md` - AI analysis source
- `ssot_unitai_known_issues_2026-01-24.md` - Issue registry
