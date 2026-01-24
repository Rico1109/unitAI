---
title: unitAI Known Issues Registry
version: 1.1.0
updated: 2026-01-24T17:20:00+01:00
scope: unitai-issues
category: ssot
subcategory: issues
domain: [di, testing, configuration, lifecycle, organization]
changelog:
  - 1.1.0 (2026-01-24): Mark DI-001, DI-002, TEST-001 as RESOLVED.
  - 1.0.0 (2026-01-24): Initial registry from architecture analysis.
---

# unitAI Known Issues Registry

## Purpose

This document catalogs observed facts about the unitAI codebase that may require attention. Each issue is documented objectively without prescribing solutions.

**Format**: Each issue describes WHAT exists, WHERE it exists, and WHY it may be significant.

---

## Dependency Injection

### ~~DI-001: AuditTrail Creates Own Database~~ ✅ RESOLVED

**Status**: Fixed in v2.1.0 (feat/di-lifecycle branch)

**Location**: `src/utils/auditTrail.ts:75`

**Observation**: The `AuditTrail` class creates its own SQLite database connection in the constructor rather than receiving it through the `AppDependencies` container defined in `dependencies.ts`.

```typescript
// auditTrail.ts:75
this.db = new Database(this.dbPath);
```

**Context**: The project has a DI container (`dependencies.ts`) that manages `activityDb`. Other SQLite connections are created independently.

**Impact**: 
- Cannot inject mock database for testing
- Multiple database connections may exist
- Lifecycle not managed by central container

---

### ~~DI-002: TokenSavingsMetrics Creates Own Database~~ ✅ RESOLVED

**Status**: Fixed in v2.1.0 (feat/di-lifecycle branch)

**Location**: `src/services/activityAnalytics.ts:101`

**Observation**: `TokenSavingsMetrics` instantiated in `ActivityAnalytics` creates its own database connection.

```typescript
// activityAnalytics.ts:100-101
this.auditTrail = new AuditTrail(auditDbPath);
this.tokenMetrics = new TokenSavingsMetrics(tokenDbPath);
```

**Context**: Same pattern as DI-001. The `ActivityAnalytics` class depends on `ActivityRepository` (which uses DI properly) but also creates `AuditTrail` and `TokenSavingsMetrics` directly.

**Impact**: Same as DI-001.

---

## Testing

### ~~TEST-001: 21 Test Failures in activityAnalytics.test.ts~~ ✅ RESOLVED

**Status**: Fixed in v2.1.0 (feat/di-lifecycle branch) - 19 failures fixed, 2 unrelated remain

**Location**: `tests/unit/services/activityAnalytics.test.ts`

**Observation**: Running `npm test` shows 21 test failures, all in `activityAnalytics.test.ts`.

**Error Pattern**: Tests fail with "Dependencies not initialized. Call initializeDependencies() first."

**Context**: The test file attempts to use `getActivityAnalytics()` which internally calls `getDependencies()`. If `initializeDependencies()` was not called before, an error is thrown.

**Relationship**: Related to DI-001 and DI-002. The singleton pattern combined with non-injected dependencies makes testing difficult.

---

## Configuration

### CFG-001: Config File Read On Every Call

**Location**: `src/config/config.ts:136`

**Observation**: The function `getRoleBackend()` calls `loadConfig()` on every invocation, which reads `~/.unitai/config.json` from disk.

```typescript
export function getRoleBackend(role: 'architect' | 'implementer' | 'tester'): string {
  const config = loadConfig(); // ← File I/O every call
  if (config && config.roles[role]) {
    return config.roles[role];
  }
  return DEFAULT_CONFIG.roles[role];
}
```

**Context**: `getRoleBackend()` is called by `AgentFactory` when creating agents.

**Impact**: File system I/O on hot path. Performance impact depends on call frequency.

---

### CFG-002: Synchronous Backend Detection

**Location**: `src/config/detectBackends.ts:56-62`

**Observation**: `detectBackends()` runs `execSync('which <command>')` for each backend sequentially.

```typescript
function isCommandAvailable(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
```

**Context**: Called during CLI wizard setup and potentially at startup.

**Impact**: Blocks the event loop. With 5 backends, this is 5 sequential sync operations.

---

## Lifecycle

### LCY-001: No Graceful Shutdown Handler

**Location**: `src/server.ts`

**Observation**: `UnitAIServer` has a `stop()` method that calls `closeDependencies()`, but there is no registration of SIGINT or SIGTERM handlers.

```typescript
// server.ts - stop() exists but is never called on signals
async stop(): Promise<void> {
  logger.info("Stopping server...");
  closeDependencies();
}
```

**Context**: MCP servers typically run as long-lived processes. Without signal handlers, Ctrl+C may not clean up properly.

**Impact**: Database connections may not close properly on termination.

---

### LCY-002: BackendStats Not Persisted

**Location**: `src/workflows/modelSelector.ts:91`

**Observation**: `BackendStats` class stores metrics in an in-memory `Map`. No persistence mechanism exists.

```typescript
class BackendStats {
  private stats = new Map<string, BackendMetrics>();
  // No save/load methods
}
```

**Context**: `BackendStats` tracks success rates and response times for backend selection optimization.

**Impact**: All historical data lost on server restart. Cannot learn from past performance.

---

### LCY-003: CircuitBreaker State Not Persisted

**Location**: `src/utils/circuitBreaker.ts`

**Observation**: `CircuitBreaker` maintains state (OPEN/CLOSED/HALF_OPEN) in memory only.

```typescript
private states: Map<string, BackendState> = new Map();
```

**Context**: Circuit breaker opens after 3 failures and resets after 5 minutes.

**Impact**: After restart, a previously failing backend will be tried again immediately (may or may not be desired behavior).

---

## Code Organization

### ORG-001: BACKENDS Exported From Multiple Files

**Location**: `src/constants.ts` and `src/utils/aiExecutor.ts`

**Observation**: `BACKENDS` constant is defined in `constants.ts` and re-exported from `aiExecutor.ts`.

```typescript
// constants.ts
export const BACKENDS = { GEMINI: "ask-gemini", ... }

// aiExecutor.ts
export { BACKENDS };
```

**Context**: Some files import from `constants.ts`, others from `aiExecutor.ts`.

**Impact**: Ambiguous source of truth. Refactoring may miss some imports.

---

### ORG-002: Duplicate Role-Backend Mapping

**Location**: `src/constants.ts:127-148` and `~/.unitai/config.json`

**Observation**: `AGENT_ROLES` in constants defines default backend mappings (architect→gemini, etc.) that also exist in config file.

```typescript
// constants.ts
export const AGENT_ROLES = {
  ARCHITECT: { backend: BACKENDS.GEMINI, ... },
  IMPLEMENTER: { backend: BACKENDS.DROID, ... },
  TESTER: { backend: BACKENDS.QWEN, ... }
}
```

**Context**: `config/config.ts` also has `DEFAULT_CONFIG.roles` with similar mappings. The runtime reads from config file, but constants also define defaults.

**Impact**: Two places to update if defaults change. Potential confusion.

---

## Summary Table

| ID | Category | Severity | Location | Status |
|----|----------|----------|----------|--------|
| ~~DI-001~~ | DI | High | `auditTrail.ts:75` | ✅ RESOLVED |
| ~~DI-002~~ | DI | High | `activityAnalytics.ts:101` | ✅ RESOLVED |
| ~~TEST-001~~ | Testing | High | `activityAnalytics.test.ts` | ✅ RESOLVED |
| CFG-001 | Config | Medium | `config.ts:136` | 🔶 OPEN |
| CFG-002 | Config | Low | `detectBackends.ts:56-62` | 🔶 OPEN |
| LCY-001 | Lifecycle | Medium | `server.ts` | 🔶 OPEN |
| LCY-002 | Lifecycle | Low | `modelSelector.ts:91` | 🔶 OPEN |
| LCY-003 | Lifecycle | Low | `circuitBreaker.ts` | 🔶 OPEN |
| ORG-001 | Organization | Low | `constants.ts`, `aiExecutor.ts` | 🔶 OPEN |
| ORG-002 | Organization | Low | `constants.ts:127-148` | 🔶 OPEN |

**Progress**: 3/10 issues resolved (30%)

---

## Related Documents

- `ssot_unitai_architecture_2026-01-24.md` - System architecture
