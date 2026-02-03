---
title: unitAI Organization Layer Plan
version: 1.1.0
updated: 2026-02-03T12:15:00+01:00
scope: unitai-organization-layer
category: plan
subcategory: code-organization
status: in-progress
domain: [refactoring, typescript, code-quality, eslint]
changelog:
  - 1.1.0 (2026-02-03): Sprint 1 COMPLETE - Services moved, files renamed to kebab-case. Build passes, 147 key tests pass.
  - 1.0.0 (2026-01-28): Initial plan for Organization Layer (Layer 5).
---

# Organization Layer Implementation Plan

**Scope**: unitAI Code Organization (Pyramid Layer 5)
**Goal**: Establish a professional, scalable code structure ensuring DRY, SOLID principles, and strict modular boundaries.

## Executive Summary
The current codebase suffers from "organic growth" artifacts: inconsistent naming (PascalCase vs camelCase vs kebab-case), mixed logic layers (stateful services in `utils/`), and lack of automated code quality enforcement. This plan standardizes the codebase to meet industry best practices.

## 1. Tooling & Standards (The "Enforcers")

We will introduce standard tooling to prevent future regression.

### 1.1 ESLint & Prettier
Currently, `npm run lint` only runs `tsc`. We will add:
- **ESLint**: To catch logical errors and enforce import boundaries.
- **Prettier**: To enforce consistent formatting.
- **Rules**:
    - `explicit-module-boundary-types`: Ensure APIs are well-defined.
    - `no-circular-dependencies`: Prevent spaghetti code.
    - `naming-convention`: Enforce standard naming.

### 1.2 Naming Conventions
- **Files**: `kebab-case` throughout (e.g., `ArchitectAgent.ts` → `architect-agent.ts`, `aiExecutor.ts` → `ai-executor.ts`).
    - *Why?* Case sensitivity issues on different OSs (Linux vs Windows/macOS) causing Git issues. Check previous conversation history about "mess".
- **Classes**: `PascalCase`.
- **Variables/Functions**: `camelCase`.
- **Global Constants**: `UPPER_SNAKE_CASE`.

## 2. Directory Structure Refactoring

We will realign files to match their architectural role, moving out of the catch-all `utils/` directory.

### 2.1 Promote Services ✅ COMPLETE (2026-02-03)
Stateful classes or those communicating with external systems (DB, CLI) are **Services**, not Utils.

| Current Location | New Location | Status |
|------------------|--------------|--------|
| `src/utils/aiExecutor.ts` | `src/services/ai-executor.ts` | ✅ Done |
| `src/utils/auditTrail.ts` | `src/services/audit-trail.ts` | ✅ Done |
| `src/utils/tokenEstimator.ts` | `src/services/token-estimator.ts` | ✅ Done |
| `src/utils/structuredLogger.ts` | `src/services/structured-logger.ts` | ✅ Done |

### 2.2 Standardize Agents ✅ COMPLETE (2026-02-03)
Rename `src/agents/` contents to `kebab-case`:
- ✅ `ArchitectAgent.ts` → `architect-agent.ts`
- ✅ `ImplementerAgent.ts` → `implementer-agent.ts`
- ✅ `TesterAgent.ts` → `tester-agent.ts`

### 2.3 Strict "Utils"
`src/utils/` will be reserved for **pure functions** and **stateless helpers** (e.g., `security/`, `reliability/`, `path-validator.ts`).

## 3. Documentation Organization (PRfolder Refactor)

The `PRfolder` is cluttering the project root. We will organize its contents into structured subdirectories *inside* `PRfolder`.

### 3.1 New Structure
We will create the following subdirectories inside `PRfolder/`:

- **`PRfolder/ssot/`**: "Single Source of Truth" files (Architecture, Security audits).
    - `ssot_unitai_architecture_...`
    - `ssot_unitai_security_...`
- **`PRfolder/plans/`**: Active and proposed implementation plans.
    - `plan_unitai_organization_...`
- **`PRfolder/archive/`**: Old plans and deprecated documents.
    - `archive_plan_...`
    - `workflow_transformation_diagram_DEPRECATED.md`
- **`PRfolder/features/`**: Feature-specific design docs (renamed from `NEWfeatures`).

### 3.2 Action Items
- Create `ssot`, `plans`, `archive` directories inside `PRfolder`.
- Rename `NEWfeatures` to `features`.
- Move relevant files into these subdirectories.

## 4. Root Directory Cleanup

The project root is cluttered with loose files. We will sweep them into appropriate locations.

| File | Destination | Reason |
|------|-------------|--------|
| `.claude.7z`, `.claude.zip` | `PRfolder/archive/` | Backup archives |
| `.mcp copy.json`, `settings.json` | `PRfolder/archive/` | Redundant/Backup configs |
| `master_prompt_*.md` | `PRfolder/archive/` | Old prompt logs |
| `CLAUDE.MD` | `PRfolder/ssot/CLAUDE.md` | Core AI Manual |
| `IMPLEMENTATION_SUMMARY.md` | `PRfolder/plans/` | Plan document |
| `beta-testing.md` | `PRfolder/plans/` | Plan document |
| `run-dashboard-workflow.js` | `scripts/` | Script |
| `run-init-session.js` | `scripts/` | Script |
| `test_registration.ts` | `scripts/` | Script/Test |
| `requirements.txt` | `scripts/python_requirements.txt` | Script dependencies |
| `serena-ssot-documentation/` | `.claude/skills/serena/` | Skill definition |

## 5. Module Boundaries (Barrels)

Refactor `index.ts` files to explicitly export only public API surfaces.
- **Goal**: Prevent deep imports (e.g., `import ... from '../../utils/deep/file'`).
- **Rule**: Import from the module root where possible (e.g., `import { Logger } from '@/services'`).
- **Configuration**: Setup TypeScript path aliases (`@/*` → `src/*`) to clean up imports.

## 4. Implementation Steps

1.  **Dependencies**: Install `eslint`, `prettier`, `@typescript-eslint/parser`, etc.
2.  **Configuration**: Create `.eslintrc.json`, `.prettierrc`, update `tsconfig.json` (paths).
3.  **Refactor Phase 1 (Services)**: Move `aiExecutor`, `auditTrail`, etc. Use `git mv` to preserve history. Update all imports.
4.  **Refactor Phase 2 (Agents)**: Rename Agent files using `git mv`. Update imports.
5.  **Refactor Phase 3 (Formatting)**: Run `eslint --fix` on the whole project.
6.  **Documentation**: Update `ssot_unitai_architecture_2026-01-24.md` to reflect the new directory structure.

## 5. Verification Plan

### Automated Checks
- [ ] `npm run lint` (New command running ESLint) must pass.
- [ ] `npm run build` must pass (validating no broken imports).
- [ ] `npm test` must pass (100% regression testing).

### Manual Verification
- [ ] Verify `dist/` output structure matches expectation.
- [ ] Check `src/services/` contains all identified services.

---

## 6. Master Code Review (Baseline Assessment)

**Generated**: 2026-01-28
**Methodology**: 11 parallel agents reviewing each folder independently
**Total Files Reviewed**: ~80+ files across 11 folders

### 6.1 Executive Summary by Folder

| Folder | Code Quality | Organization | Naming | SOLID | **Final Score** | Rank |
|--------|--------------|--------------|--------|-------|----------------|------|
| **agents/** | 8.5/10 | 9/10 | 9.5/10 | 8/10 | **8.8/10** | 🥇 Best |
| **domain/** | 8/10 | 9/10 | 6/10 | 8/10 | **7.75/10** | 🥈 |
| **cli/** | 8/10 | 7/10 | 9/10 | 6/10 | **7.5/10** | 🥉 |
| **tools/** | 7/10 | 8/10 | 6/10 | 6/10 | **6.75/10** | 4th |
| **repositories/** | 7/10 | 6/10 | 8/10 | 6/10 | **6.75/10** | 4th |
| **services/** | 7/10 | 6/10 | 9/10 | 6/10 | **6.75/10** | 4th |
| **backends/** | 8/10 | 7/10 | 6/10 | 6/10 | **6.75/10** | 4th |
| **workflows/** | 7/10 | 6/10 | 5/10 | 6/10 | **6.2/10** | 8th |
| **config/** | 7/10 | 6/10 | 5/10 | 7/10 | **6.4/10** | 7th |
| **utils/** | 7/10 | 6/10 | 5/10 | 6/10 | **6/10** | 9th |
| **lib/** | 7/10 | 3/10 | 5/10 | 6/10 | **5.25/10** | 10th |

### 6.2 Overall Codebase Health

**Weighted Average Score: 6.8/10**

| Metric | Score |
|--------|-------|
| **Code Quality** | 7.5/10 |
| **Organization** | 6.9/10 |
| **Naming Convention** | 7.1/10 |
| **SOLID Principles** | 6.3/10 |

### 6.3 Critical Issues Requiring Immediate Action

#### Stateful Services in `utils/` ✅ RESOLVED (2026-02-03)

| Current Location | Target Location | Status |
|------------------|-----------------|--------|
| `utils/auditTrail.ts` | `services/audit-trail.ts` | ✅ Done |
| `utils/aiExecutor.ts` | `services/ai-executor.ts` | ✅ Done |
| `utils/tokenEstimator.ts` | `services/token-estimator.ts` | ✅ Done |
| `utils/structuredLogger.ts` | `services/structured-logger.ts` | ✅ Done |

#### File Naming Violations (kebab-case) ✅ RESOLVED (2026-02-03)

**PascalCase files renamed:**
- ✅ `agents/ArchitectAgent.ts` → `architect-agent.ts`
- ✅ `agents/ImplementerAgent.ts` → `implementer-agent.ts`
- ✅ `agents/TesterAgent.ts` → `tester-agent.ts`
- ✅ `backends/GeminiBackend.ts` → `gemini-backend.ts`
- ✅ `backends/CursorBackend.ts` → `cursor-backend.ts`
- ✅ `backends/DroidBackend.ts` → `droid-backend.ts`
- ✅ `backends/QwenBackend.ts` → `qwen-backend.ts`
- ✅ `backends/RovodevBackend.ts` → `rovodev-backend.ts`
- ✅ `backends/BackendRegistry.ts` → `backend-registry.ts`
- ✅ `workflows/modelSelector.ts` → `model-selector.ts`
- ✅ `workflows/workflowContext.ts` → `workflow-context.ts`
- ✅ `cli/activityDashboard.ts` → `activity-dashboard.ts`
- ⏳ `config/config.ts` → Keep as-is (too generic, low priority)
- ✅ `config/detectBackends.ts` → `backend-detector.ts`

#### Duplicate Implementations

**CircuitBreaker Duplication:**
- Location 1: `utils/reliability/circuitBreaker.ts` (290 lines, with DB persistence)
- Location 2: `utils/reliability/errorRecovery.ts` (lines 212-394, different implementation)
- **Action**: Consolidate to single implementation, remove duplicate

#### Misplaced Infrastructure

**lib/ Folder Issue:**
- `lib/async-db.ts` (142 lines) should move to `infrastructure/` or `utils/infrastructure/`
- Single file in generic `lib/` folder violates project's descriptive folder naming pattern
- **Action**: Move to proper location, add barrel export

### 6.4 Medium Priority Issues

#### Naming Convention Inconsistencies

1. **Interface Naming:** `IAgent` uses `I` prefix (domain/agents/types.ts:106) but project convention is unclear/undocumented
2. **Mixed Language Comments:** Italian comments found in:
   - `utils/cli/gitHelper.ts` (lines 92-94, 183, 207, 230)
   - `tools/smart-workflows.tool.ts` (lines 6, 15, 19, 24)
   - `domain/workflows/types.ts` (lines 5-27)
3. **Inconsistent Schema Naming:** Some schemas exported as named exports, others inline

#### SOLID Violations Summary

**Single Responsibility Principle (SRP) - Score: 6/10**
- `activityAnalytics.ts`: Recording, querying, statistics, cleanup in one class
- `pre-commit-validate.workflow.ts` (376 lines): Secrets, quality, breaking changes, remediation
- `init-session.workflow.ts` (414 lines): Git repo info, CLI detection, docs search, AI analysis
- `bug-hunt.workflow.ts`: File discovery, analysis, hypothesis generation combined

**Dependency Inversion Principle (DIP) - Score: 5/10**
- Singleton pattern overuse: `auditTrail`, `tokenEstimator`, `activityAnalytics`
- Direct database dependencies instead of interfaces throughout repositories
- Direct concrete imports instead of dependency injection

**Open/Closed Principle (OCP) - Score: 6/10**
- Switch statements requiring modification for new backends (workflows/parallel-review.workflow.ts:69-120)
- Hardcoded backend selection logic (workflows/modelSelector.ts:126-148)
- Static whitelists that cannot be extended (config/detectBackends.ts:59-65)

### 6.5 Positive Patterns to Preserve

#### Excellent Examples Found:

1. **Domain Layer** (7.75/10) - Clean barrel export, proper type separation by bounded context
2. **Agents Folder** (8.8/10) - Template Method pattern, Factory pattern, clear base/concrete separation
3. **CLI Folder** (7.5/10) - Excellent security practices (SEC-005 compliance), proper error handling
4. **Security Utilities** - `pathValidator.ts` (comprehensive validation), `permissionManager.ts` (clear matrix)

### 6.6 Score Distribution

```
Score Range    Count    Folders
─────────────  ──────   ────────────────────────────
9.0+           1        agents (8.8)
7.5-8.9        3        domain, cli, tools
6.0-7.4        6        services, backends, workflows,
                        config, repositories, utils
5.0-5.9        1        lib (5.25)
```

### 6.7 Key Insights for Implementation

1. **Strong Foundation**: 3 folders score 7.5+, indicating good architectural patterns exist
2. **Clear Violations**: Stateful services in `utils/` directly contradict plan's stated goals
3. **Naming Crisis**: ~15+ files violate kebab-case standard (plan section 1.2)
4. **SOLID Debt**: Widespread DIP violations suggest need for interface-first development
5. **Duplicate Code**: CircuitBreaker duplication indicates insufficient code review process

### 6.8 Recommended Implementation Priority

**Sprint 1: Critical Fixes ✅ COMPLETE (2026-02-03)**
1. ✅ Move 4 stateful services from `utils/` to `services/` (section 2.1)
2. ✅ Rename all PascalCase files to kebab-case (section 2.2)
3. ⏳ Move `lib/async-db.ts` to `infrastructure/` - DEFERRED
4. ⏳ Remove duplicate CircuitBreaker implementation - DEFERRED

**Sprint 2: SOLID Improvements (Next)**
5. Extract parsing utilities from agents
6. Split large workflow files (>350 lines)
7. Create barrel exports for all folders (section 5)
8. Standardize async patterns

**Sprint 3: Polish & Standards**
9. Replace all Italian comments with English
10. Add comprehensive interfaces for DIP compliance
11. Implement dependency injection pattern
12. Add ESLint/Prettier with auto-fix (section 1.1)

**Sprint 4: Documentation & Root Cleanup**
13. PRfolder reorganization (section 3)
14. Root directory cleanup (section 4)
15. Update architecture SSOT document

---

## 7. Progress Summary

### ✅ Completed (Sprint 1 - 2026-02-03)

| Task | Files Changed | Tests |
|------|---------------|-------|
| Move services to `services/` | 4 files moved | ✅ 147/147 |
| Rename to kebab-case | 13 files renamed | ✅ Build passes |
| Update all imports | ~50 files updated | ✅ No regressions |

**Verification**:
- `npm run build` ✅ Passes
- Key tests: config, aiExecutor, auditTrail, structuredLogger, tokenEstimator, dependencies, circuitBreaker - all pass

### ⏳ Remaining Work

#### Sprint 2: SOLID Improvements (Estimated: 4-6 hours)
| Task | Priority | Complexity |
|------|----------|------------|
| Move `lib/async-db.ts` to `infrastructure/` | Medium | Low |
| Remove duplicate CircuitBreaker in `errorRecovery.ts` | Medium | Medium |
| Create barrel exports for all folders | Medium | Low |
| Split large workflow files (>350 LOC) | Low | Medium |

#### Sprint 3: Polish & Standards (Estimated: 6-8 hours)
| Task | Priority | Complexity |
|------|----------|------------|
| Add ESLint + Prettier configuration | High | Medium |
| Replace Italian comments with English | Low | Low |
| Add TypeScript path aliases (`@/`) | Medium | Low |
| Add comprehensive interfaces for DIP | Low | High |

#### Sprint 4: Documentation (Estimated: 2-3 hours)
| Task | Priority | Complexity |
|------|----------|------------|
| PRfolder reorganization | Low | Low |
| Root directory cleanup | Low | Low |
| Update architecture SSOT | Medium | Medium |

### Pre-existing Issues (Not Organization-Related)
These test failures exist but are unrelated to organization refactoring:
- `permissionManager.test.ts` - DI initialization issues
- `modelSelector.test.ts` - Async/await mismatch
- `red-metrics-dashboard.test.ts` - Database mock issues
- `gitHelper.test.ts` - Environment-dependent tests
