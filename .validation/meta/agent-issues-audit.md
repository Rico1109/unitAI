# unitAI Agent Issues Audit

**Date**: 2026-02-04
**Auditor**: Claude Opus 4.5 (manual code verification)
**Purpose**: Document discrepancies between agent-generated reports and actual codebase state

---

## Executive Summary

During post-validation manual verification, significant discrepancies were discovered between what the validation agents reported and the actual state of the codebase. This document catalogs all identified issues for cross-reference against project sprints.

### Key Findings

| Category | Count | Severity |
|----------|-------|----------|
| Hallucinated Blockers | 1 major | CRITICAL |
| Real Import Path Issues | 6 files | HIGH |
| Italian Comments | 32 instances | LOW |
| Documentation Drift | 185% test count error | MEDIUM |
| Missing Files Referenced | 1 file | HIGH |
| Test Failures (actual) | 36 tests | MEDIUM |

---

## 1. HALLUCINATED BLOCKERS

### 1.1 Fabricated Import Path Issue

**What Validation Agents Claimed:**
```
BLOCKER: Import path mismatch
ERROR: Module not found '../../src/lib/async-db.js'
ACTUAL PATH: 'src/infrastructure/async-db.js'

Affected Files (claimed 91 tests blocked):
1. tests/unit/dependencies.test.ts (line 10) - 13 tests
2. tests/unit/auditTrail.test.ts (line 15) - 45 tests
3. tests/unit/services/activityAnalytics.test.ts (line 12) - 18 tests
4. tests/unit/repositories/metrics.test.ts (line 9) - 15 tests
```

**Actual Reality:**
```bash
# Search for claimed wrong path
$ grep -rn "src/lib/async-db" --include="*.ts" .
# Result: NO MATCHES FOUND

# Actual import in dependencies.test.ts line 10:
import { AsyncDatabase } from '../../src/infrastructure/async-db.js';
# ^^^ This is CORRECT! Not broken!
```

**Verification Evidence:**
- `src/lib/` directory does not exist
- `src/lib/async-db.js` was never a valid path
- All AsyncDatabase imports already use correct path `src/infrastructure/async-db.js`
- The "91 blocked tests" figure was fabricated

**Sprint Cross-Reference:**
- Sprint 1 (Directory Refactor) moved async-db.ts to `src/infrastructure/`
- Test files were apparently updated correctly
- Agent hallucinated a problem that doesn't exist

**Impact:** Validation report's "P0 CRITICAL BLOCKER" was entirely fabricated

---

## 2. REAL IMPORT PATH ISSUES

These are the **actual** broken imports that exist in the codebase:

### 2.1 permissionManager.js Path Errors

**Wrong Path:** `src/utils/permissionManager.js`
**Correct Path:** `src/utils/security/permissionManager.js`

**Affected Files:**
| File | Line | Import Statement |
|------|------|------------------|
| `tests/integration/workflows.test.ts` | 6 | `import { AutonomyLevel } from '../../src/utils/permissionManager.js'` |
| `tests/integration/init-session-docs.test.ts` | 43 | `import { AutonomyLevel } from '../../src/utils/permissionManager.js'` |
| `tests/utils/testHelpers.ts` | 6 | `import type { AutonomyLevel } from '../../src/utils/permissionManager.js'` |

**Sprint Cross-Reference:**
- Sprint 1 moved permissionManager.ts to `src/utils/security/`
- These 3 test files were NOT updated during Sprint 1
- Agent completing Sprint 1 marked it as "COMPLETE" without verifying tests

---

### 2.2 gitHelper.js Path Errors

**Wrong Path:** `src/utils/gitHelper.js`
**Correct Path:** `src/utils/cli/gitHelper.js`

**Affected Files:**
| File | Line | Import Statement |
|------|------|------------------|
| `tests/utils/mockGit.ts` | 119-120 | `vi.doMock('../../src/utils/gitHelper.js', ...)` |
| `tests/unit/workflows/pre-commit-validate.test.ts` | 7, 12 | `import * as gitHelper from '../../../src/utils/gitHelper.js'` |

**Sprint Cross-Reference:**
- Sprint 1 moved gitHelper.ts to `src/utils/cli/`
- These 2 test files were NOT updated during Sprint 1
- mockGit.ts mock path is wrong, breaking git-related test mocking

---

### 2.3 circuitBreaker.js - FILE DOES NOT EXIST

**Critical Issue:** Tests import from a file that doesn't exist!

**Wrong Path:** `src/utils/reliability/circuitBreaker.js`
**Reality:** This file does not exist. CircuitBreaker class is in `errorRecovery.ts`

**Actual File Structure:**
```
src/utils/reliability/
├── errorRecovery.ts    ← CircuitBreaker class is HERE (lines 233-422)
└── index.ts            ← Re-exports CircuitBreaker from errorRecovery.ts
```

**Affected Files:**
| File | Line | Import Statement |
|------|------|------------------|
| `tests/unit/dependencies.test.ts` | 23 | `vi.mock('../../src/utils/reliability/circuitBreaker.js', ...)` |
| `tests/unit/dependencies.test.ts` | 215 | `await import('../../src/utils/reliability/circuitBreaker.js')` |
| `tests/unit/workflows/modelSelector.test.ts` | 15 | `import { CircuitBreaker } from '../../../src/utils/reliability/circuitBreaker.js'` |

**Sprint Cross-Reference:**
- Unknown when circuitBreaker.ts was consolidated into errorRecovery.ts
- Possibly during reliability layer work or organization sprints
- Tests were never updated to reflect this consolidation
- Agent(s) may have created tests assuming a file structure that never existed

**Verification Command:**
```bash
$ ls -la src/utils/reliability/circuitBreaker.ts
# "src/utils/reliability/circuitBreaker.ts": No such file or directory
```

---

### 2.4 Complete Import Path Fix Map

| Test File | Wrong Import | Correct Import |
|-----------|--------------|----------------|
| `tests/integration/workflows.test.ts:6` | `../../src/utils/permissionManager.js` | `../../src/utils/security/permissionManager.js` |
| `tests/integration/init-session-docs.test.ts:43` | `../../src/utils/permissionManager.js` | `../../src/utils/security/permissionManager.js` |
| `tests/utils/testHelpers.ts:6` | `../../src/utils/permissionManager.js` | `../../src/utils/security/permissionManager.js` |
| `tests/utils/mockGit.ts:119-120` | `../../src/utils/gitHelper.js` | `../../src/utils/cli/gitHelper.js` |
| `tests/unit/workflows/pre-commit-validate.test.ts:7,12` | `../../../src/utils/gitHelper.js` | `../../../src/utils/cli/gitHelper.js` |
| `tests/unit/dependencies.test.ts:23,215` | `../../src/utils/reliability/circuitBreaker.js` | `../../src/utils/reliability/errorRecovery.js` or `../../src/utils/reliability/index.js` |
| `tests/unit/workflows/modelSelector.test.ts:15` | `../../../src/utils/reliability/circuitBreaker.js` | `../../../src/utils/reliability/errorRecovery.js` or index |

---

## 3. ITALIAN COMMENTS

### 3.1 Overview

**Total Count:** 32 Italian comments across 6 files
**Sprint Reference:** Sprint 3 (Polish & Standards) was supposed to replace these
**Status:** Sprint 3 marked as "INCOMPLETE" in documentation

### 3.2 Affected Files

| File | Count | Example Comments |
|------|-------|------------------|
| `src/workflows/init-session.workflow.ts` | ~12 | "Estrai parole dal messaggio di commit", "Cerca corrispondenze di keywords" |
| `src/workflows/parallel-review.workflow.ts` | ~8 | "Ordina per numero di matches (decrescente)" |
| `src/workflows/validate-last-commit.workflow.ts` | ~4 | "Informazioni base del repository" |
| `src/workflows/utils.ts` | ~3 | "Ottieni gli ultimi 10 commits" |
| `src/utils/cli/gitHelper.ts` | ~3 | Various Italian comments |
| `src/domain/workflows/types.ts` | ~2 | Type definition comments |

### 3.3 Sample Italian Comments Found

```typescript
// From init-session.workflow.ts:
// Estrai parole dal messaggio di commit
// Estrai anche dai nomi dei file modificati
// Se è un heading markdown, rimuovi il marcatore
// Altrimenti usa la prima riga non vuota
// Cerca corrispondenze di keywords nel content
// Ordina per numero di matches (decrescente)
// Informazioni base del repository
// Ottieni gli ultimi 10 commits con diffs completi
// Commit recenti (sommario)
// Analisi AI con fallback tra più backend
// Cerca documentation e memorie rilevanti basandosi sui commit
// Status dettagliato
// Informazioni sui branch
// Avvisi se qualche CLI non è disponibile
// Informazioni sulla sessione
```

### 3.4 Sprint Cross-Reference

- **Sprint 3 Goal:** "Polish & standards (ESLint, Prettier, Italian comments)"
- **Sprint 3 Status:** Marked as "INCOMPLETE" in SSOT docs
- **Implication:** Agent(s) working on Sprint 3 did not complete Italian comment replacement
- **Not a Hallucination:** This is documented incomplete work, not fabricated

---

## 4. DOCUMENTATION DRIFT

### 4.1 Test Count Discrepancy

**Documented Count:** 178 tests
**Actual Count:** 508 tests (now ~400 after some changes)
**Discrepancy:** 185% undercounting

**Sources Claiming 178:**
- PRfolder/ssot/ssot_unitai_testing_2026-01-24.md
- PRfolder/ssot/ssot_unitai_pyramid_status_2026-01-26.md
- Various planning documents

**Sprint Cross-Reference:**
- Test count was likely accurate at time of initial documentation
- Agents added tests but did not update documentation
- No documentation update step in agent workflows
- Suggests agents focus on implementation, neglect doc updates

### 4.2 Document Count Discrepancy

**Claimed:** 14 SSOT documents
**Actual:** 12 SSOT documents
**Missing:** 2 documents (unidentified)

### 4.3 Layer Status Discrepancies

| Layer | Documented Status | Actual Status |
|-------|-------------------|---------------|
| Layer 5 | "BLOCKED by import path" | Working, different issues |
| Layer 3 | "No tests" | Correct, but CircuitBreaker code is solid |
| Layer 4 | "508 tests, 40 failures" | ~400 tests, 36 failures |

---

## 5. ACTUAL TEST FAILURE ANALYSIS

### 5.1 Current Test Results

```
Test Files:  12 failed | 14 passed (26)
Tests:       36 failed | 364 passed (400)
Errors:      14 errors
Duration:    101.16s
```

### 5.2 Failure Categories

**Category 1: Import Path Failures (Module Not Found)**
- `tests/integration/workflows.test.ts` - permissionManager path
- `tests/integration/init-session-docs.test.ts` - permissionManager path
- `tests/unit/workflows/modelSelector.test.ts` - circuitBreaker path
- `tests/unit/workflows/pre-commit-validate.test.ts` - gitHelper path

**Category 2: Dependencies Not Initialized**
- Error: `CRITICAL: Audit trail failure - operation aborted. Dependencies not initialized.`
- Cause: Tests not properly mocking or initializing DI container
- Files: `permissionManager.test.ts`, others

**Category 3: Mock/Spy Issues**
- `dependencies.test.ts` - "expected spy to be called with arguments"
- `dependencies.test.ts` - "[Function shutdown] is not a spy"
- Cause: Mock setup doesn't match actual implementation

**Category 4: Environment-Dependent**
- `gitHelper.test.ts` - 9 failures
- Cause: Tests assume specific git state (branch, commits)
- Not isolated from actual environment

**Category 5: Logger Stream Errors**
- Error: `Cannot read properties of undefined (reading 'size')`
- Files: `red-metrics-dashboard.test.ts`, `bug-hunt.test.ts`
- Cause: structuredLogger not properly mocked

### 5.3 Comparison: Claimed vs Actual

| Metric | Validation Claimed | Actual |
|--------|-------------------|--------|
| Total Tests | 508 | ~400 |
| Failing | 40 | 36 |
| Blocked | 91 (by async-db) | 0 (that issue doesn't exist) |
| Pass Rate | 88.6% | 91% |

---

## 6. AGENT COORDINATION FAILURES

### 6.1 Sprint 1: Directory Refactor

**Claimed Status:** COMPLETE
**Actual Issues:**
- Files moved correctly ✓
- Production imports updated ✓
- Test imports NOT updated ✗
- 6+ test files have wrong import paths

**Root Cause:** Agent marked sprint complete without running tests or verifying imports

### 6.2 Sprint 3: Polish & Standards

**Claimed Status:** INCOMPLETE (documented)
**Actual Issues:**
- ESLint configured ✓
- Prettier configured ✓
- Italian comments NOT replaced (32 remain) ✗

**Root Cause:** Agent started but did not complete Italian comment replacement

### 6.3 CircuitBreaker Consolidation

**When:** Unknown (not clearly documented)
**What Happened:**
- CircuitBreaker class was consolidated into errorRecovery.ts
- Tests were written/left importing from non-existent circuitBreaker.js
- No barrel export adjustment for backward compatibility

**Root Cause:** Either:
- Tests written before consolidation, never updated
- Tests written by agent assuming file structure that never existed (hallucination)
- Consolidation done without updating tests

### 6.4 Validation Agent Issues

**What Happened:**
- Agents detected "import path errors" symptom correctly
- Agents hallucinated specific wrong path (`src/lib/async-db.js`)
- Agents fabricated details (91 tests, 4 files with line numbers)
- Agents missed actual wrong paths

**Root Cause:** Agents may:
- See error patterns and guess/fabricate specifics
- Not verify claims against actual codebase
- Assume plausible-sounding details rather than checking

---

## 7. FILE STRUCTURE REFERENCE

### 7.1 Actual Current Structure

```
src/
├── utils/
│   ├── security/
│   │   ├── pathValidator.ts
│   │   ├── permissionManager.ts      ← Tests import from wrong path
│   │   ├── promptSanitizer.ts
│   │   └── index.ts
│   ├── cli/
│   │   ├── commandExecutor.ts
│   │   ├── gitHelper.ts              ← Tests import from wrong path
│   │   └── index.ts
│   ├── reliability/
│   │   ├── errorRecovery.ts          ← CircuitBreaker is HERE
│   │   └── index.ts                  ← Re-exports CircuitBreaker
│   ├── data/
│   │   ├── dashboardRenderer.ts
│   │   └── index.ts
│   ├── logger.ts
│   └── legacyLogger.ts
├── infrastructure/
│   └── async-db.ts                   ← Correctly referenced
├── services/
│   ├── ai-executor.ts
│   ├── audit-trail.ts
│   ├── structured-logger.ts
│   └── token-estimator.ts
└── ...
```

### 7.2 Files That Don't Exist (But Are Referenced)

| Referenced Path | Actual Location |
|-----------------|-----------------|
| `src/utils/permissionManager.ts` | `src/utils/security/permissionManager.ts` |
| `src/utils/gitHelper.ts` | `src/utils/cli/gitHelper.ts` |
| `src/utils/reliability/circuitBreaker.ts` | Does not exist (class in `errorRecovery.ts`) |
| `src/lib/async-db.ts` | Never existed (hallucinated) |

---

## 8. VERIFICATION COMMANDS

### 8.1 Verify Hallucinated Path Doesn't Exist

```bash
# Search for the claimed wrong path
grep -rn "src/lib/async-db" --include="*.ts" .
# Expected: No results

# Verify src/lib doesn't exist
ls -la src/lib/
# Expected: No such file or directory
```

### 8.2 Find Real Import Issues

```bash
# Find wrong permissionManager imports
grep -rn "src/utils/permissionManager" --include="*.ts" tests/

# Find wrong gitHelper imports
grep -rn "src/utils/gitHelper" --include="*.ts" tests/

# Find wrong circuitBreaker imports
grep -rn "src/utils/reliability/circuitBreaker" --include="*.ts" tests/
```

### 8.3 Verify CircuitBreaker Location

```bash
# Check if circuitBreaker.ts exists
ls -la src/utils/reliability/circuitBreaker.ts
# Expected: No such file

# Find CircuitBreaker class
grep -n "class CircuitBreaker" src/utils/reliability/errorRecovery.ts
# Expected: Line 233
```

### 8.4 Count Italian Comments

```bash
grep -rn "Estrai\|Cerca\|Ordina\|Ottieni\|Analisi\|Informazioni\|Avvisi" \
  --include="*.ts" src/ | wc -l
# Expected: ~32
```

### 8.5 Run Actual Tests

```bash
npm test -- --run 2>&1 | tail -50
# See actual failures, not hallucinated ones
```

---

## 9. RECOMMENDATIONS FOR SPRINT VALIDATION

### 9.1 Sprint 1 (Directory Refactor) - NEEDS RE-VALIDATION

**Claimed:** COMPLETE
**Actual:** Production code complete, test imports broken

**Action Required:**
- [ ] Fix 6 test files with wrong import paths
- [ ] Re-run full test suite
- [ ] Update sprint status only after tests pass

### 9.2 Sprint 3 (Polish & Standards) - NEEDS COMPLETION

**Claimed:** INCOMPLETE
**Actual:** Correctly documented as incomplete

**Action Required:**
- [ ] Replace 32 Italian comments with English
- [ ] Verify ESLint/Prettier configs work
- [ ] Mark complete only after verification

### 9.3 CircuitBreaker Consolidation - NEEDS DOCUMENTATION

**Claimed:** N/A (not documented as separate task)
**Actual:** CircuitBreaker was consolidated but tests not updated

**Action Required:**
- [ ] Document when/why consolidation happened
- [ ] Fix 3 test files importing non-existent file
- [ ] Consider creating circuitBreaker.ts as re-export for backward compatibility

### 9.4 Validation Process - NEEDS IMPROVEMENT

**Issue:** Agents hallucinate specific details

**Action Required:**
- [ ] Always verify agent claims with actual commands
- [ ] Don't trust specific file/line references without checking
- [ ] Run actual tests, don't rely on agent-reported test counts
- [ ] Cross-reference agent reports against each other

---

## 10. SUMMARY TABLE

| Issue | Sprint Reference | Claimed Status | Actual Status | Action |
|-------|------------------|----------------|---------------|--------|
| async-db import path | N/A | BLOCKER | HALLUCINATED | None needed |
| permissionManager imports | Sprint 1 | COMPLETE | BROKEN | Fix 3 files |
| gitHelper imports | Sprint 1 | COMPLETE | BROKEN | Fix 2 files |
| circuitBreaker imports | Unknown | N/A | BROKEN | Fix 3 files |
| Italian comments | Sprint 3 | INCOMPLETE | INCOMPLETE | Replace 32 |
| Test count docs | Layer 4 | 178 tests | 400+ tests | Update docs |
| CircuitBreaker tests | Layer 3 | "No tests" | Tests exist but broken | Fix imports |

---

## 11. APPENDIX: RAW EVIDENCE

### 11.1 Actual Test Output

```
Test Files:  12 failed | 14 passed (26)
Tests:       36 failed | 364 passed (400)
Errors:      14 errors

Failed Files:
- tests/unit/tokenEstimator.metrics.test.ts (1 failed)
- tests/integration/server.test.ts (1 failed)
- tests/unit/tools/red-metrics-dashboard.test.ts (3 failed)
- tests/unit/workflows/bug-hunt.test.ts (3 failed)
- tests/unit/permissionManager.test.ts (7 failed)
- tests/unit/dependencies.test.ts (2 failed)
- tests/unit/gitHelper.test.ts (9 failed)
- tests/unit/repositories/metrics.test.ts (10 failed)
- tests/integration/init-session-docs.test.ts (module not found)
- tests/integration/workflows.test.ts (module not found)
- tests/unit/workflows/modelSelector.test.ts (module not found)
- tests/unit/workflows/pre-commit-validate.test.ts (module not found)
```

### 11.2 Module Not Found Errors

```
Error: Failed to load url ../../src/utils/permissionManager.js
  in /home/rico/Projects/CodeBase/unitAI/tests/integration/workflows.test.ts

Error: Failed to load url ../../../src/utils/reliability/circuitBreaker.js
  in /home/rico/Projects/CodeBase/unitAI/tests/unit/workflows/modelSelector.test.ts

Error: Failed to load url ../../../src/utils/gitHelper.js
  in /home/rico/Projects/CodeBase/unitAI/tests/unit/workflows/pre-commit-validate.test.ts
```

---

**Document End** | Agent Issues Audit v1.0 | 2026-02-04
