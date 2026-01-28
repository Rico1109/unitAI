---
title: DI Consistency Improvement Plan
version: 1.0.0
updated: 2026-01-24T16:10:00+01:00
scope: unitai-di-plan
category: archive
subcategory: dependency-injection
status: completed
archived_date: 2026-01-26
domain: [di, architecture, testing]
related_issues: [DI-001, DI-002, TEST-001]
changelog:
  - 1.0.0 (2026-01-24): Initial plan based on Known Issues analysis.
---

# DI Consistency Improvement Plan

## Objective

Consolidate all database connections under the central DI container (`dependencies.ts`) to enable proper lifecycle management and testing.

## Scope

| Issue ID | Component | Current State |
|----------|-----------|---------------|
| DI-001 | `AuditTrail` | Creates own SQLite DB at `data/audit.sqlite` |
| DI-002 | `TokenSavingsMetrics` | Creates own SQLite DB |
| TEST-001 | Tests | May fail when DI not initialized |

## Current Architecture

```
dependencies.ts
    └── activityDb (data/activity.sqlite) ✅ Managed

auditTrail.ts
    └── db (data/audit.sqlite) ❌ Self-managed

activityAnalytics.ts
    └── tokenMetrics → own DB ❌ Self-managed
    └── auditTrail → own DB ❌ Self-managed
    └── repository ✅ Uses injected activityDb
```

## Target Architecture

```
dependencies.ts
    ├── activityDb (data/activity.sqlite)
    ├── auditDb (data/audit.sqlite) ← NEW
    └── tokenDb (data/tokens.sqlite) ← NEW (or shared with audit)

AuditTrail
    └── Receives db via constructor ✅

TokenSavingsMetrics
    └── Receives db via constructor ✅

ActivityAnalytics
    └── Receives all dependencies via constructor ✅
```

---

## Implementation Steps

### Step 1: Extend AppDependencies Interface

**File**: `src/dependencies.ts`

**Change**: Add `auditDb` to the interface.

```typescript
export interface AppDependencies {
    activityDb: Database.Database;
    auditDb: Database.Database;  // ADD THIS
}
```

### Step 2: Initialize auditDb in Container

**File**: `src/dependencies.ts`

**Change**: Create and manage `auditDb` alongside `activityDb`.

```typescript
export function initializeDependencies(): AppDependencies {
    // ... existing code ...
    
    // Initialize Audit Database
    const auditDbPath = path.join(dataDir, 'audit.sqlite');
    logger.debug(`Opening Audit DB at ${auditDbPath}`);
    const auditDb = new Database(auditDbPath);
    auditDb.pragma('journal_mode = WAL');
    
    dependencies = {
        activityDb,
        auditDb  // ADD THIS
    };
    
    return dependencies;
}
```

### Step 3: Close auditDb on Shutdown

**File**: `src/dependencies.ts`

**Change**: Close `auditDb` in `closeDependencies()`.

```typescript
export function closeDependencies(): void {
    if (dependencies) {
        logger.info("Closing dependencies...");
        dependencies.activityDb.close();
        dependencies.auditDb.close();  // ADD THIS
        dependencies = null;
    }
}
```

### Step 4: Modify AuditTrail to Accept Injected DB

**File**: `src/utils/auditTrail.ts`

**Change**: Constructor accepts `Database` instead of creating one.

```typescript
export class AuditTrail {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeSchema();
  }
  
  // Remove file path handling - that's now in dependencies.ts
  // Remove: this.dbPath = ...
  // Remove: fs.mkdirSync(...)
  // Remove: this.db = new Database(this.dbPath)
}
```

### Step 5: Update AuditTrail Singleton

**File**: `src/utils/auditTrail.ts`

**Change**: Singleton now uses DI container.

```typescript
// REMOVE the old singleton:
// export const auditTrail = new AuditTrail();

// ADD lazy singleton that uses DI:
let auditTrailInstance: AuditTrail | null = null;

export function getAuditTrail(): AuditTrail {
    if (!auditTrailInstance) {
        const deps = getDependencies();
        auditTrailInstance = new AuditTrail(deps.auditDb);
    }
    return auditTrailInstance;
}

// For testing - allows resetting
export function resetAuditTrail(): void {
    auditTrailInstance = null;
}
```

### Step 6: Update All AuditTrail Usages

**Files to update**:
- `src/utils/permissionManager.ts` - uses `auditTrail.record()`
- `src/workflows/modelSelector.ts` - uses `logAudit()`
- Any other files importing `auditTrail`

**Change**: Replace direct singleton access with `getAuditTrail()`.

```typescript
// BEFORE
import { auditTrail } from './auditTrail.js';
auditTrail.record(...);

// AFTER
import { getAuditTrail } from './auditTrail.js';
getAuditTrail().record(...);
```

### Step 7: Apply Same Pattern to TokenSavingsMetrics

**File**: `src/utils/tokenEstimator.ts` (or wherever TokenSavingsMetrics is defined)

**Change**: Same pattern as AuditTrail - inject DB via constructor.

### Step 8: Update ActivityAnalytics

**File**: `src/services/activityAnalytics.ts`

**Change**: Don't create AuditTrail/TokenSavingsMetrics internally.

```typescript
export class ActivityAnalytics {
  constructor(
    repository: ActivityRepository,
    auditTrail: AuditTrail,        // INJECT instead of create
    tokenMetrics: TokenSavingsMetrics  // INJECT instead of create
  ) {
    this.auditTrail = auditTrail;
    this.tokenMetrics = tokenMetrics;
    this.repository = repository;
    this.repository.initializeSchema();
  }
}
```

### Step 9: Update getActivityAnalytics Factory

**File**: `src/services/activityAnalytics.ts`

**Change**: Factory creates all dependencies from DI container.

```typescript
export function getActivityAnalytics(): ActivityAnalytics {
  if (!analyticsInstance) {
    const deps = getDependencies();
    const repo = new ActivityRepository(deps.activityDb);
    const audit = getAuditTrail();
    const tokens = getTokenSavingsMetrics();
    analyticsInstance = new ActivityAnalytics(repo, audit, tokens);
  }
  return analyticsInstance;
}
```

---

## Testing Changes

### New Test Helper

Create `tests/utils/testDependencies.ts`:

```typescript
import Database from 'better-sqlite3';

export function createTestDependencies() {
    return {
        activityDb: new Database(':memory:'),
        auditDb: new Database(':memory:')
    };
}
```

### Update Test Setup

In test files, initialize DI before tests:

```typescript
import { initializeDependencies, closeDependencies } from '../src/dependencies';

beforeAll(() => {
    initializeDependencies();
});

afterAll(() => {
    closeDependencies();
});
```

---

## Verification

After implementation, verify:

1. **Unit Tests Pass**: `npm test` shows no failures
2. **Server Starts**: `npm start` works correctly
3. **Graceful Shutdown**: Ctrl+C closes all DBs (check logs)
4. **Single DB Files**: Only expected SQLite files in `data/`

---

## Files Modified Summary

| File | Type of Change |
|------|---------------|
| `src/dependencies.ts` | Add `auditDb`, update init/close |
| `src/utils/auditTrail.ts` | Accept injected DB, lazy singleton |
| `src/utils/tokenEstimator.ts` | Accept injected DB (if applicable) |
| `src/services/activityAnalytics.ts` | Accept injected services |
| `src/utils/permissionManager.ts` | Use `getAuditTrail()` |
| `src/workflows/modelSelector.ts` | Use `getAuditTrail()` |
| `tests/utils/testDependencies.ts` | NEW - test helpers |

---

## Related Documents

- `ssot_unitai_architecture_2026-01-24.md` - System architecture
- `ssot_unitai_known_issues_2026-01-24.md` - Issue registry
