---
title: Layer 5 Observability Implementation Plan
version: 1.0.0
updated: 2026-01-26T11:03:00+01:00
scope: unitai-observability
category: plan
subcategory: implementation
domain: [observability, logging, metrics]
changelog:
  - 1.0.0 (2026-01-26): Completion plan for Layer 5.
---

# Layer 5: Observability Implementation Plan

## Goal
Complete remaining 40% of observability layer to reach commit-ready state.

---

## Remaining Tasks

### Task 1: Request IDs Verification (30 min)
**File:** `src/server.ts`

Check if requestId is:
1. Generated for each MCP request
2. Passed to tool execution context
3. Logged in structuredLogger

**Verify:**
```bash
grep -n "requestId" src/server.ts
```

### Task 2: parentSpanId Wiring (1 hour)
**File:** `src/utils/structuredLogger.ts`

1. Ensure `parentSpanId` field is populated when logging nested operations
2. WorkflowLogger should pass parent context

**Verify:**
```bash
grep -n "parentSpanId" src/utils/structuredLogger.ts
```

### Task 3: Tests for MetricsRepository (2 hours)
**File to create:** `tests/unit/repositories/metrics.test.ts`

Test cases:
- [ ] `record()` inserts metric correctly
- [ ] `query()` filters work (component, backend, time range)
- [ ] `getREDStats()` calculates rate, error rate, percentiles
- [ ] `getErrorBreakdown()` groups by error type

**Run:**
```bash
npm test -- metrics.test.ts
```

### Task 4: Tests for Dashboard Tool (1 hour)
**File to create:** `tests/unit/tools/red-metrics-dashboard.test.ts`

Test cases:
- [ ] Returns formatted output with all RED sections
- [ ] Handles empty metrics gracefully
- [ ] Filters by component/backend work

**Run:**
```bash
npm test -- red-metrics-dashboard.test.ts
```

### Task 5: Build Verification (15 min)
```bash
npm run build
```

Must pass without errors.

### Task 6: Commit (10 min)
```bash
git add src/ tests/ PRfolder/
git commit -m "feat(observability): implement RED metrics dashboard and logging bridge

- Add MetricsRepository for RED metrics storage (Rate, Errors, Duration)
- Add red-metrics-dashboard tool with P50/P95/P99 latency
- Add legacyLogger bridge for migration
- Include observability SSOT and pyramid status tracking

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Verification Plan

| Test | Command | Expected |
|------|---------|----------|
| Build | `npm run build` | Exit 0, no errors |
| Unit tests | `npm test` | All pass |
| Coverage | `npm run test:coverage -- metrics` | >80% for metrics.ts |

---

## Time Estimate

| Task | Effort |
|------|--------|
| Request IDs | 30 min |
| parentSpanId | 1 hour |
| Metrics tests | 2 hours |
| Dashboard tests | 1 hour |
| Build + Commit | 30 min |
| **Total** | **5 hours** |

---

## Delegation Notes

This plan can be delegated to execution agents. Key files:
- `src/repositories/metrics.ts` (understand schema first)
- `tests/unit/circuitBreaker.test.ts` (follow test pattern)
- `tests/utils/testDependencies.ts` (use in-memory DB)
