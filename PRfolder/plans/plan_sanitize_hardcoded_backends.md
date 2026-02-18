# Plan: Sanitize Hardcoded Backends

**Date:** 2026-02-17
**Status:** Ready to implement
**Branch:** `feature/unit-ai-main`

---

## 1. Why This Exists

Workflows hardcode specific backends (e.g., `BACKENDS.CURSOR`) for specific steps. If a user doesn't have that tool installed, the step crashes. The goal is to make every workflow use whatever backend the user has configured, while keeping sensible recommended defaults based on model strengths.

**Core user story:** "I don't have Cursor or Rovodev. I want unitAI to use Gemini, Qwen, and Droid instead — and still work correctly."

---

## 2. How the System Works (read this first)

### The foundation (already correct, do not touch)

| File | What it does |
|---|---|
| `src/backends/backend-registry.ts` | Singleton registry of all 5 backend executors |
| `src/backends/types.ts` | `IBackendExecutor` interface + `BackendExecutionOptions` (unified options) |
| `src/services/ai-executor.ts` | `executeAIClient()` — central executor with circuit breaker, fallback, RED metrics. Also contains `transformOptionsForBackend()` which already handles file attachment translation based on `getCapabilities().fileMode` |
| `src/config/config.ts` | `getRoleBackend(role)` — reads `~/.unitai/config.json`, falls back to `DEFAULT_CONFIG.roles` |
| `src/workflows/model-selector.ts` | `selectParallelBackends()`, `selectOptimalBackend()` — already dynamic, respects enabled backends + circuit breaker |

### The three roles and their recommended defaults

Defined in `src/config/config.ts` → `DEFAULT_CONFIG.roles` and `src/constants.ts` → `AGENT_ROLES`:

| Role | Recommended backend | Strength |
|---|---|---|
| `architect` | `ask-gemini` | Deep reasoning, semantic search, long-term analysis |
| `implementer` | `ask-droid` | Autonomous execution, code generation, checklists |
| `tester` | `ask-qwen` | Fast validation, edge cases, logical consistency |

User overrides these in `~/.unitai/config.json` → `roles: { architect, implementer, tester }`.

### The agent identity files (important context)

These files define rich role identities with structured prompts. They are used when agent classes are invoked directly (not by workflows currently, but they define the canonical identity for each role):

| File | Identity prompt |
|---|---|
| `src/agents/architect-agent.ts` | "You are an expert Software Architect with deep knowledge of design patterns, system architecture, and software engineering best practices." Focus areas: design, refactoring, optimization, security, scalability |
| `src/agents/implementer-agent.ts` | "You are an expert Code Implementer. Your task is to generate production-ready code with proper error handling, documentation, and best practices." |
| `src/agents/tester-agent.ts` | "You are an expert Test Engineer specializing in comprehensive test generation." |

These identities are the reference for what each role means. Workflow prompts should align with these.

### The already-correct example

`src/workflows/triangulated-review.workflow.ts` already does this right:
```typescript
const architectBackend  = getRoleBackend('architect');
const testerBackend     = getRoleBackend('tester');
const implementerBackend = getRoleBackend('implementer');
```
No `BACKENDS.X` literals anywhere. This is the target pattern for all workflows.

---

## 3. What Is Broken vs What Is Fine

### CRITICAL — Workflow crashes without the pinned backend

These workflows hardcode `BACKENDS.X` directly in `executeAIClient()` calls. If the user doesn't have that backend, the step fails.

| Workflow | File | Hardcoded backend(s) | Step that breaks |
|---|---|---|---|
| `feature-design` | `src/workflows/feature-design.workflow.ts` | `BACKENDS.CURSOR` (line ~186), `BACKENDS.GEMINI`, `BACKENDS.DROID` (lines ~304, 317, 330) | Planning step + validation loop |
| `refactor-sprint` | `src/workflows/refactor-sprint.workflow.ts` | `BACKENDS.CURSOR` (~28), `BACKENDS.GEMINI` (~49), `BACKENDS.DROID` (~65) | All three steps |
| `auto-remediation` | `src/workflows/auto-remediation.workflow.ts` | `BACKENDS.DROID` (~27) | Only step |
| `bug-hunt` | `src/workflows/bug-hunt.workflow.ts` | `BACKENDS.GEMINI` (~130, ~181), `BACKENDS.QWEN` (~202), `BACKENDS.DROID` (~258), `BACKENDS.ROVODEV` (~279) | Search + remediation steps |

### FINE — Already dynamic, degrades gracefully

These workflows already use `selectParallelBackends()` which respects user config and circuit breaker. The `switch(backend)` blocks customize prompts for known backends and fall through to a working `default` for unknown ones. No crash risk.

| Workflow | Why it's fine |
|---|---|
| `parallel-review` | `selectParallelBackends()` picks available backends. `switch(backend)` for prompts has working `default`. Options builder returns `{}` for unknown backends. |
| `validate-last-commit` | Same pattern as `parallel-review`. |
| `pre-commit-validate` | Flag conditions (`backend === BACKENDS.DROID`) only fire if Droid is actually selected — if it's not available, conditions never trigger. |

### NOT a problem (already handled)

- **File attachments per backend** — `transformOptionsForBackend()` in `ai-executor.ts` already handles this via `getCapabilities().fileMode`. Embeds files in prompt if backend can't take `--file` flags.
- **Flag leakage** — `BackendExecutionOptions` is a unified interface. Each backend executor reads only the options it understands and ignores the rest. Passing `{ autoApprove: true }` to Gemini does nothing.

---

## 4. The Fix — One Rule Applied Consistently

Replace `BACKENDS.X` literals with `getRoleBackend(role)` where role is determined by the step's function:

| Step function | Role to use |
|---|---|
| Planning / analysis / semantic search / architecture | `'architect'` |
| Execution / implementation / auto-apply / remediation | `'implementer'` |
| Validation / testing / verification / checklists | `'tester'` |

**Import to add at the top of each fixed file:**
```typescript
import { getRoleBackend } from '../config/config.js';
```

**Options after the swap:** Pass all relevant options and let each backend's executor handle what it understands. `BackendExecutionOptions` is designed for this. No adapter layer needed.

---

## 5. Implementation Steps (in order)

### Step 1 — `auto-remediation.workflow.ts` (trivial, 1 line)

**File:** `src/workflows/auto-remediation.workflow.ts`
**Change:** Line ~27, replace `backend: BACKENDS.DROID` with `backend: getRoleBackend('implementer')`
**Add import:** `getRoleBackend` from `'../config/config.js'`
**Verify:** `npm run build` — zero errors.

---

### Step 2 — `refactor-sprint.workflow.ts` (3 direct calls)

**File:** `src/workflows/refactor-sprint.workflow.ts`

| Line | Current | Replace with |
|---|---|---|
| ~28 | `backend: BACKENDS.CURSOR` | `backend: getRoleBackend('implementer')` |
| ~49 | `backend: BACKENDS.GEMINI` | `backend: getRoleBackend('architect')` |
| ~65 | `backend: BACKENDS.DROID` | `backend: getRoleBackend('tester')` |

**Add import:** `getRoleBackend` from `'../config/config.js'`
**Note:** The options passed alongside each call (`{ prompt: ... }`) stay unchanged. They are backend-agnostic.
**Verify:** `npm run build` + `npm test`.

---

### Step 3 — `feature-design.workflow.ts` (most complex)

**File:** `src/workflows/feature-design.workflow.ts`

**Change 1:** Line ~186 — Cursor planning step:
```typescript
// Before
backend: BACKENDS.CURSOR

// After
backend: getRoleBackend('implementer')
```

**Change 2:** Lines ~300–335 — The validation loop uses `switch(backendName)` with raw string literals (`"ask-gemini"`, not even `BACKENDS.GEMINI`). Replace the entire switch with role-based calls:
```typescript
// Before (switch on raw string)
switch (backendName) {
  case "ask-gemini":
    backend = BACKENDS.GEMINI; ...
  case "ask-cursor":
    backend = BACKENDS.CURSOR; ...
  case "ask-droid":
    backend = BACKENDS.DROID; ...
}

// After
// Pick backends via roles, not names
const validationBackends = [
  getRoleBackend('architect'),
  getRoleBackend('implementer')
].filter((b, i, arr) => arr.indexOf(b) === i); // deduplicate if same backend assigned to both roles
```
Then run validation calls against `validationBackends` with role-appropriate prompts.

**Add import:** `getRoleBackend` from `'../config/config.js'`
**Verify:** `npm run build` + `npm test`.

---

### Step 4 — `bug-hunt.workflow.ts` (most structural change)

**File:** `src/workflows/bug-hunt.workflow.ts`

This workflow has two hardcoded phases:

**Phase A — Initial search (line ~130):**
```typescript
// Before
backend: BACKENDS.GEMINI

// After
backend: getRoleBackend('architect')
```

**Phase B — Parallel analysis (lines ~166–170):**
```typescript
// Before
const runGemini  = selectedBackends.includes(BACKENDS.GEMINI);
const runCursor  = selectedBackends.includes(BACKENDS.CURSOR);
const runDroid   = selectedBackends.includes(BACKENDS.DROID);
const runRovodev = selectedBackends.includes(BACKENDS.ROVODEV);
const runQwen    = selectedBackends.includes(BACKENDS.QWEN);

// After — check by role, not by name
const architectBackend   = getRoleBackend('architect');
const implementerBackend = getRoleBackend('implementer');
const testerBackend      = getRoleBackend('tester');

const runArchitect   = selectedBackends.includes(architectBackend);
const runImplementer = selectedBackends.includes(implementerBackend);
const runTester      = selectedBackends.includes(testerBackend);
```

**Phase C — Remediation (lines ~257–280):**
```typescript
// Before — tries Droid first, then Rovodev
backend: BACKENDS.DROID
backend: BACKENDS.ROVODEV

// After — use implementer role, let circuit breaker handle fallback
backend: getRoleBackend('implementer')
```
The existing retry-with-fallback in `executeAIClient()` will handle unavailability automatically.

**Note on `hypothesisBackend` (lines ~222–227):**
```typescript
// Before
if (runQwen) { hypothesisBackend = BACKENDS.QWEN; }
else if (runCursor) { hypothesisBackend = BACKENDS.CURSOR; }

// After
if (runTester) { hypothesisBackend = testerBackend; }
else if (runImplementer) { hypothesisBackend = implementerBackend; }
```

**Add import:** `getRoleBackend` from `'../config/config.js'`
**Verify:** `npm run build` + `npm test` — this is the most complex change, test carefully.

---

### Step 5 — Verification pass

After all four files are fixed:

```bash
rm -rf dist && npm run build
```

Check that `dist/` contains no `BACKENDS.CURSOR`, `BACKENDS.DROID` etc. as standalone calls (they may still appear in the Category B switch statements, which is fine):

```bash
grep -r "BACKENDS\." dist/workflows/ | grep -v "switch\|case\|parallel-review\|validate-last-commit\|pre-commit"
```

Run tests:
```bash
npm test
```

---

### Step 6 — Optional cleanup (separate PR, not blocking)

These are cosmetic improvements, not required for correctness:

1. **Prompt text in `parallel-review` and `validate-last-commit`** — The switch cases say `"As Gemini, ..."` and `"As Cursor Agent, ..."`. These can be rewritten to role-based language (`"As the Architect, ..."`) to avoid confusion when a different backend is assigned to that role. Not a bug — any model understands the instruction regardless of the name.

2. **Workflow descriptions** — `parallelReviewWorkflow.description` says *"Executes a parallel code analysis using Gemini, Cursor and Droid"*. Should say *"using configured backends"*.

3. **`getRoleBackend()` disk reads** — Currently reads `~/.unitai/config.json` from disk on every call. Workflows that call it multiple times (bug-hunt: 4+ times) hit disk repeatedly. A session-level cache would improve performance. Out of scope for this refactor.

---

## 6. What Not To Touch

| File | Reason |
|---|---|
| `src/backends/*.ts` | Backend executors are correct and self-contained |
| `src/services/ai-executor.ts` | `transformOptionsForBackend()` already handles options translation |
| `src/workflows/model-selector.ts` | `selectParallelBackends()` is already dynamic |
| `src/workflows/parallel-review.workflow.ts` | Already uses dynamic selection, degrades gracefully |
| `src/workflows/validate-last-commit.workflow.ts` | Same |
| `src/workflows/pre-commit-validate.workflow.ts` | Same |
| `src/workflows/triangulated-review.workflow.ts` | Already the correct pattern — reference implementation |
| `src/config/config.ts` | `getRoleBackend()` and `DEFAULT_CONFIG` are correct |
| `src/constants.ts` | `BACKENDS` and `AGENT_ROLES` are correct |

---

## 7. Execution Rules

1. **One file at a time.** Fix, build, verify, then move to the next.
2. **Clean build between steps.** `rm -rf dist && npm run build`
3. **Never edit `dist/`.**
4. **Do not change the Category B workflows** (`parallel-review`, `validate-last-commit`, `pre-commit-validate`) — they work correctly as-is.

---

## 8. Files Changed Summary

| File | Change type | Steps |
|---|---|---|
| `src/workflows/auto-remediation.workflow.ts` | 1 line | Step 1 |
| `src/workflows/refactor-sprint.workflow.ts` | 3 lines | Step 2 |
| `src/workflows/feature-design.workflow.ts` | Switch replacement | Step 3 |
| `src/workflows/bug-hunt.workflow.ts` | Structural rework of includes() pattern | Step 4 |
