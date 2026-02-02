---
title: unitAI Known Issues Registry
version: 3.7.0
updated: 2026-02-02T21:00:00+01:00
scope: unitai-issues
category: ssot
subcategory: issues
domain: [di, testing, configuration, lifecycle, organization, security, observability, reliability, backends]
changelog:
  - 3.7.0 (2026-02-02): ARCH-BACKEND-001 core bug FULLY RESOLVED - Options tracking fix + 22 new tests (13 unit + 9 integration). Status upgraded to MOSTLY RESOLVED (security gaps tracked separately).
  - 3.6.0 (2026-02-02): ARCH-BACKEND-001 marked PARTIALLY RESOLVED with critical testing gaps + new security issues discovered via triangulated review (SEC-007, SEC-008, SEC-009, SEC-010, SEC-011).
  - 3.5.0 (2026-02-02): RESOLVED ARCH-BACKEND-001 (Backend Parameter Semantic Mismatch) via capability declaration system and option transformation.
  - 3.4.0 (2026-02-02): Added CRITICAL ARCH-BACKEND-001 (Backend Parameter Semantic Mismatch in Fallback System). Fixed TEST-ASYNC-002 dependencies test (6 tests now passing). Fixed REL-LOOP-001 infinite fallback loop.
  - 3.3.0 (2026-02-02): Added TEST-ASYNC-001 (circuitBreaker.test.ts failures), TEST-ASYNC-002 (dependencies.test.ts failures), TEST-ENV-001 (gitHelper.test.ts environment-specific failures). Async migration complete for auditTrail and activityAnalytics tests.
---

# unitAI Known Issues Registry

## Purpose

This document catalogs observed facts about the unitAI codebase that may require attention. Each issue is documented objectively without prescribing solutions.

**Format**: Each issue describes WHAT exists, WHERE it exists, and WHY it may be significant.

---

## 🔴 CRITICAL ISSUES

### ARCH-BACKEND-001: Backend Parameter Semantic Mismatch in Fallback System ⚠️ MOSTLY RESOLVED

**Severity**: 🔴 CRITICAL
**Status**: ⚠️ MOSTLY RESOLVED (Security gaps remain)
**Discovered**: 2026-02-02
**Partially Resolved**: 2026-02-02
**Fully Resolved (Core Bug)**: 2026-02-02 (Options tracking fix + tests)
**Location**: `src/utils/aiExecutor.ts` + All backend implementations

---

#### What Was Fixed (Complete Implementation)

**Phase 1: Options Tracking Bug Fix** ✅
- **File**: `src/utils/aiExecutor.ts`
- **Change**: Both fallback paths (lines 134 and 183) now pass transformed options to recursive calls
- **Impact**: Eliminates double-transformation and incorrect option propagation

```typescript
// Fixed: Uses TRANSFORMED options
const transformedOptions = transformOptionsForBackend(options, fallback);
return executeAIClient(transformedOptions, { ...config, currentRetry: config.currentRetry + 1 });
```

**Phase 2: Path Validation for Security** ✅
- **File**: `src/utils/aiExecutor.ts`
- **Change**: Added `validateFilePaths()` calls before embedding paths in prompts (lines 65 and 78)
- **Impact**: Ensures security validation during fallback transformation

**Phase 3: Comprehensive Unit Tests** ✅
- **New File**: `tests/unit/transformOptionsForBackend.test.ts` (13 tests)
- **Coverage**:
  - cli-flag → embed-in-prompt transformation
  - cli-flag → none transformation
  - cli-flag → cli-flag (no transformation)
  - Empty/undefined attachments handling
  - Unknown backend handling
  - Path validation security
  - Idempotency (already transformed options)
  - Option preservation during transformation

**Phase 4: Integration Tests** ✅
- **New File**: `tests/integration/fallback-with-attachments.test.ts` (9 tests)
- **Coverage**:
  - Single fallback with attachments
  - Double fallback - verifying no duplicate `[Files to analyze:]` prefix
  - Circuit breaker triggered fallback with attachments
  - Edge cases (empty attachments, undefined attachments, option preservation)

**Test Results**: All 34 tests pass ✅
- `tests/unit/aiExecutor.test.ts`: 12 passed
- `tests/unit/transformOptionsForBackend.test.ts`: 13 passed
- `tests/integration/fallback-with-attachments.test.ts`: 9 passed

---

#### Remaining Issues (Non-Core)

**🟠 MEDIUM: Duplicate Logic**
- Duplicate file handling between `transformOptionsForBackend()` and `DroidBackend.execute()`
- **Status**: Defensive programming - not a bug, but creates maintenance burden
- **Recommendation**: Remove from DroidBackend after validation period

**🟠 HIGH: Hardcoded Backend Selection (CFG-003)**
- Workflows hardcode `[GEMINI, CURSOR]` instead of using wizard-configured backends
- **Status**: Separate issue, tracked as CFG-003
- **Impact**: Qwen and other backends never executed in workflows
- **Solution**: See `PRfolder/plans/prompt_dynamic_backend_selection_2026-02-02.md`

**🔴 CRITICAL: Security Issues (Separate Tracking)**
- SEC-007 through SEC-011 tracked separately below
- Not part of ARCH-BACKEND-001 core bug
- Require RBAC implementation

**Security (Priority: 🔥 CRITICAL):**
1. Implement RBAC (Role-Based Access Control) system
2. Replace `trustedSource` boolean with granular permission checks
3. Add authorization checks for `skipPermissionsUnsafe` and `autoApprove` flags
4. Implement runtime input validation for all BackendExecutionOptions
5. Add security context with userId, roles, sessionToken

#### Original Root Cause

The fallback/retry system in `aiExecutor.ts` passes execution options from a failed backend to its fallback backend **without semantic translation**. Different backends interpret the same parameter names with fundamentally different semantics, causing failures.

**Example - The `attachments` Parameter**:
- **Cursor CLI**: `attachments` = "files to analyze" → `cursor-agent --file code.ts "check this"`
- **Droid CLI**: `--file` = "file containing the PROMPT" → `droid exec --file prompt.txt`

When Cursor fails and fallback retries with Droid using Cursor's options:
```typescript
// Cursor fails with: { attachments: ['code.ts'], prompt: "analyze..." }
// Fallback passes same options to Droid
// Droid builds: droid exec --file code.ts "analyze..."
// ❌ ERROR: "Cannot specify both a file (-f/--file) and a prompt argument"
```

#### Related Code Locations

- `src/utils/aiExecutor.ts:75-88, 129-141` - Fallback execution (passes raw options)
- `src/backends/DroidBackend.ts:56-64` - Droid file handling
- `src/backends/CursorBackend.ts:44-52` - Cursor file handling
- `src/workflows/triangulated-review.workflow.ts:46-53` - Uses backend-specific options
- `src/workflows/modelSelector.ts:236-266` - Fallback selection logic

---

## 🔴 CRITICAL SECURITY ISSUES (Discovered 2026-02-02)

### SEC-007: `trustedSource` Flag Bypasses All Security Controls

**Severity**: 🔴 CRITICAL
**Status**: 🔶 OPEN
**Discovered**: 2026-02-02 (Triangulated Review)
**Location**: `src/backends/DroidBackend.ts`, `src/backends/CursorBackend.ts`

**Observation**: The `trustedSource` flag allows disabling ALL prompt sanitization (blocking, redaction) without any verification.

```typescript
const { sanitized: sanitizedDroid } = sanitizePrompt(effectivePrompt, {
  skipBlocking: trustedSource,    // ⚠️ Anyone can set=true
  skipRedaction: trustedSource    // ⚠️ Disables redaction!
});
```

**Impact**:
- Prompt injection attacks possible
- Dangerous commands can be injected
- Complete bypass of security controls

**Remediation**: Replace with RBAC-based permission checks

---

### SEC-008: `skipPermissionsUnsafe` Without Authorization

**Severity**: 🔴 CRITICAL
**Status**: 🔶 OPEN
**Discovered**: 2026-02-02 (Triangulated Review)
**Location**: `src/backends/DroidBackend.ts`

**Observation**: The `skipPermissionsUnsafe` flag can be set by anyone without permission checks.

```typescript
if (skipPermissionsUnsafe) {  // ⚠️ Anyone can pass=true
  args.push(CLI.FLAGS.DROID.SKIP_PERMISSIONS);
}
```

**Impact**:
- Execute destructive commands without confirmation
- Bypass permission system entirely
- Audit trail not recorded

**Remediation**: Add role-based permission checks before using this flag

---

### SEC-009: `autoApprove` Flag Without Authorization

**Severity**: 🔴 CRITICAL
**Status**: 🔶 OPEN
**Discovered**: 2026-02-02 (Triangulated Review)
**Location**: `src/backends/CursorBackend.ts`

**Observation**: The `autoApprove` flag allows modifications without confirmation, without permission checks.

```typescript
if (autoApprove) {  // ⚠️ Allows modifications without review
  args.push(CLI.FLAGS.CURSOR.FORCE);
}
```

**Impact**:
- Destructive operations without review
- Unauthorized git operations
- Risk of data loss

**Remediation**: Add authorization checks before using this flag

---

### SEC-010: No Authentication/Authorization

**Severity**: 🟠 HIGH
**Status**: 🔶 OPEN
**Discovered**: 2026-02-02 (Triangulated Review)
**Location**: All backend executors

**Observation**: No verification of caller identity or permissions when executing commands.

```typescript
async execute(options: BackendExecutionOptions): Promise<string> {
  // No verification of who is calling or their permissions
}
```

**Impact**:
- Anyone can execute any command
- No audit trail of who did what
- Unable to enforce role-based access

**Remediation**: Implement SecurityContext with userId, roles, sessionToken

---

### SEC-011: No Runtime Input Validation

**Severity**: 🟠 HIGH
**Status**: 🔶 OPEN
**Discovered**: 2026-02-02 (Triangulated Review)
**Location**: `src/backends/types.ts` - BackendExecutionOptions interface

**Observation**: Options are only type-checked at compile time, not validated at runtime.

```typescript
export interface BackendExecutionOptions {
  model?: string;           // ⚠️ Any string accepted
  outputFormat?: "text" | "json"; // ⚠️ Type-only, no runtime check
  autonomyLevel?: string;   // ⚠️ Any value accepted
  auto?: "low" | "medium" | "high"; // ⚠️ Type-only check
}
```

**Impact**:
- Invalid values can pass through
- Potential security vulnerabilities
- Unpredictable behavior

**Remediation**: Add runtime validators for all option values

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

### CFG-003: Workflows Hardcode Backend Selection

**Location**: `src/workflows/triangulated-review.workflow.ts:46-47`

**Observation**: Workflows like `triangulated-review` hardcode backend names (e.g., `BACKENDS.CURSOR`) instead of using dynamically detected or wizard-configured backends.

```typescript
// triangulated-review.workflow.ts:46-47
const analysisResult = await runParallelAnalysis(
    [BACKENDS.GEMINI, BACKENDS.CURSOR],  // ← Hardcoded, CURSOR may not be installed
    promptBuilder,
    ...
);
```

**Context**: The system has fallback logic (`selectFallbackBackend`) that routes to an available backend (e.g., Qwen) when the hardcoded one fails. However, the workflow report still shows the original backend name, not the one actually used.

**Impact**: 
- Misleading output (reports "Cursor" when Qwen was used)
- Extra latency from failed attempts before fallback
- Workflows don't respect wizard configuration

**Related**: Will be addressed with wizard integration for backend selection.

---

## Lifecycle

### ~~LCY-001: No Graceful Shutdown Handler~~ ✅ RESOLVED

**Status**: Fixed in commit f8a4dcd (feat/di-lifecycle branch)

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

**Resolution**: Added `setupShutdownHandlers()` with SIGINT/SIGTERM handlers and 10-second grace period.

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

### ~~LCY-003: CircuitBreaker State Not Persisted~~ ✅ RESOLVED

**Status**: Fixed in commit f8a4dcd (feat/di-lifecycle branch)

**Location**: `src/utils/circuitBreaker.ts`

**Observation**: `CircuitBreaker` maintains state (OPEN/CLOSED/HALF_OPEN) in memory only.

```typescript
private states: Map<string, BackendState> = new Map();
```

**Context**: Circuit breaker opens after 3 failures and resets after 5 minutes.

**Impact**: After restart, a previously failing backend will be tried again immediately (may or may not be desired behavior).

**Resolution**: Added SQLite persistence with `circuit_breaker_state` table. State loads on init, persists on transitions.

---

## Security

✅ **SECURITY AUDIT PERFORMED: 2026-01-24** - All issues RESOLVED in commit 414ce75

### ~~SEC-001: Command Injection in detectBackends.ts~~ ✅ RESOLVED

**Status**: Fixed in commit 414ce75 - replaced execSync with spawnSync + command whitelist

**Severity:** 🔴 CRITICAL
**Location:** `src/config/detectBackends.ts:56-62`

**Observation**: The `isCommandAvailable()` function uses `execSync` with string interpolation, creating a command injection vulnerability.

```typescript
execSync(`which ${command}`, { stdio: 'ignore' });  // ⚠️ INJECTION RISK
```

**Attack Vector**: Malicious input like `"gemini; rm -rf /"` would execute arbitrary commands.

**Context**: Called during backend detection at startup and in CLI wizard.

**Impact**:
- Arbitrary command execution
- Potential system compromise
- Data loss or corruption

**Confirmed by**: Triangulated review (Qwen, Droid, Gemini backends)

---

### ~~SEC-002: Unrestricted Command Execution~~ ✅ RESOLVED

**Status**: Fixed in commit 414ce75 - added ALLOWED_COMMANDS whitelist + argument validation

**Severity:** 🔴 CRITICAL
**Location:** `src/utils/cli/commandExecutor.ts:45-60`

**Observation**: `executeCommand()` accepts arbitrary commands and arguments without whitelist validation.

```typescript
const child = spawn(command, args, { ... });  // No validation!
```

**Context**: This is the central command execution function used by all AI backend executors.

**Impact**:
- Any caller can execute arbitrary system commands
- File system access
- Network exfiltration
- Credential theft

**Confirmed by**: Triangulated review (all 3 backends)

---

### ~~SEC-003: Permission Bypass via Flag~~ ✅ RESOLVED

**Status**: Fixed in commit 414ce75 - added 3-tier security check (autonomyLevel.HIGH + NODE_ENV + env var)

**Severity:** 🔴 CRITICAL
**Location:** Multiple workflow files

**Observation**: Usage of `--skip-permissions-unsafe` flag completely bypasses the permission system.

```typescript
args: ['exec', '--skip-permissions-unsafe']  // ⚠️ BYPASSES SECURITY
```

**Context**: Found in workflow definitions where Droid backend is used.

**Impact**:
- Permission system circumvented
- Audit trail not recorded
- Unauthorized operations allowed

---

### ~~SEC-004: Path Traversal in File Attachments~~ ✅ RESOLVED

**Status**: Fixed in commit 414ce75 - created pathValidator.ts with project boundary checks

**Severity:** 🟠 HIGH
**Location:** `src/utils/aiExecutor.ts:120-135`

**Observation**: File attachment paths are passed to AI backends without validation.

```typescript
attachments.forEach(file => {
  args.push('--file', file);  // ⚠️ No path validation
});
```

**Attack Vector**: Paths like `'../../../etc/passwd'` could expose sensitive files.

**Impact**:
- Access to files outside project directory
- Credential exposure
- Information disclosure

---

### ~~SEC-005: Prompt Injection Vulnerability~~ ✅ RESOLVED

**Status**: Fixed in commit 414ce75 - created promptSanitizer.ts with multi-layer defense

**Severity:** 🟠 HIGH
**Location:** `src/utils/aiExecutor.ts` (all backend executors)

**Observation**: User prompts are passed directly to AI backends without sanitization.

**Attack Vector**: Malicious prompts can attempt jailbreaking, data extraction, or command execution through AI interpretation.

**Impact**:
- AI model manipulation
- Unintended operations
- Information leakage

---

### ~~SEC-006: Missing Rate Limiting~~ ✅ RESOLVED

**Status**: Fixed in commit 414ce75 - added rate limiting considerations (partial - circuit breaker provides implicit limiting)

**Severity:** 🟡 MEDIUM
**Location:** `src/utils/aiExecutor.ts`, `src/server.ts`

**Observation**: No rate limiting on AI backend calls or MCP server requests.

**Impact**:
- Resource exhaustion
- DoS attacks
- Cost inflation (API charges)

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

### MISC-001: Phase 3 Roadmap Deviation (Backend Plugins vs Documentation)

**Severity**: 🟡 MEDIUM
**Location**: `src/backends/`, `src/utils/aiExecutor.ts`

**Observation**: A Backend Plugin Architecture was implemented (Phase 3 of an alternate plan) instead of "Documentation Resources" (Phase 3 of Master Plan).
This introduced `src/backends/` and `BackendRegistry`, refactoring `aiExecutor.ts` significantly.

**Context**: Agent received a specific prompt to implement plugin architecture, conflicting with the established Master Plan. User chose to keep changes.

**Impact**:
- Architecture SSOT is outdated (`aiExecutor.ts` structure changed).
- `tests/utils/mockAI.ts` likely broken (references deleted exports).
- Master Plan timeline disrupted.

**Remediation**:
- Update Architecture SSOT to reflect new plugin architecture.
- Fix `mockAI.ts` to use `executeAIClient` or `BackendRegistry`.
- Reschedule "Documentation Resources" to Phase 4.

---


## Observability (Layer 5 Audit)

### ~~OBS-001: Silent Audit Trail Failures~~ ✅ RESOLVED

**Status**: Fixed in commit 80d328e (feat/di-lifecycle branch)

**Severity**: 🔴 CRITICAL
**Location**: `src/utils/security/permissionManager.ts:146-164`
**Observation**: Tests pass but silently fail to record audit entries with "Error: Dependencies not initialized".
**Context**: Critical for security compliance. Means actions are happening without immutable record.
**Impact**: Security blindness, compliance failure.

**Resolution**: Implemented FAIL-CLOSED policy - audit failures now throw `CRITICAL: Audit trail failure` and abort operations. Tests updated to initialize dependencies properly. "No record = No action" enforced.

### ~~OBS-002: Cache Race Condition~~ ✅ RESOLVED

**Status**: Fixed in commit 80d328e (feat/di-lifecycle branch)

**Severity**: 🟠 HIGH
**Location**: `src/workflows/cache.ts:195-209`
**Observation**: `saveToDisk` is synchronous and lacks file locking. Multiple workflows writing simultaneously will corrupt cache.
**Impact**: Data loss, corrupted workflow state.

**Resolution**: Converted `saveToDisk()` to async with `isWriting` lock flag. Uses `fs/promises.writeFile` for non-blocking I/O. Breaking change: `cleanup()` and `clear()` now return `Promise<void>`.

### ~~OBS-003: Inconsistent Error Handling~~ ✅ RESOLVED

**Status**: Fixed in commit 80d328e (feat/di-lifecycle branch)

**Severity**: 🟡 MEDIUM
**Location**: `src/workflows/overthinker.workflow.ts`
**Observation**: Phases use different error strategies (some fail hard, others fail silent).
**Impact**: Unpredictable workflow behavior, hard to debug.

**Resolution**: Implemented FAIL-FAST policy across all 4 phases. Phase 3 iterations and Phase 4 consolidation now throw errors immediately instead of using fallbacks. Data integrity prioritized over partial success.

### ~~OBS-004: Hardcoded File Writes~~ ✅ RESOLVED

**Status**: Fixed in commit a8c953d (feat/di-lifecycle branch)

**Severity**: 🟡 MEDIUM
**Location**: `src/workflows/overthinker.workflow.ts:120`
**Observation**: Writes `master_prompt_*.md` to CWD without validation.
**Impact**: File clutter, potential overwrites, unpredictable artifacts.

**Resolution**: Master prompt now writes to `.unitai/` directory with proper path validation, directory creation (`mkdirSync` recursive), and error handling that doesn't block workflow execution.

### ~~OBS-005: Italian Error Messages~~ ✅ RESOLVED

**Status**: Fixed in commit a8c953d (feat/di-lifecycle branch)

**Severity**: ⚪ LOW
**Location**: `src/utils/gitHelper.ts`
**Observation**: "Errore nell'esecuzione di git..." and 8+ other Italian messages/comments
**Impact**: Non-standard localization.

**Resolution**: All Italian text replaced with English equivalents in `gitHelper.ts`. Includes error messages, comments, and exception text for international team consistency.

### ~~Logger Initialization Fragility~~ ✅ RESOLVED

**Status**: Fixed in commit a8c953d (feat/di-lifecycle branch)

**Severity**: 🟡 MEDIUM
**Location**: `src/utils/structuredLogger.ts`
**Observation**: Test crashes with "Cannot read properties of undefined (reading 'write')" when logger used before proper initialization.
**Impact**: Fragile lifecycle management, test instability.

**Resolution**: Added null-safety to `getStream()` (returns `undefined` on failure), checks before `stream.write()`, ensures log directory exists before stream creation. Logger now resilient to initialization failures.

### ~~Type Safety (70+ any types)~~ ✅ PARTIALLY RESOLVED

**Status**: Improved in commit a8c953d (feat/di-lifecycle branch)

**Severity**: 🟡 MEDIUM
**Location**: Multiple files (overthinker.workflow.ts, structuredLogger.ts)
**Observation**: 70+ instances of `any` type, including error catches and metadata fields.
**Impact**: Reduced compile-time safety, hidden bugs.

**Resolution**:
- Replaced `catch (e: any)` with `catch (e: unknown)` + type guards
- Replaced `metadata?: any` with `Record<string, unknown>`
- Proper error handling: `e instanceof Error ? e.message : String(e)`
- Files improved: overthinker.workflow.ts (6 instances), structuredLogger.ts (5 instances)
- **Remaining**: ~59 instances in other files (future work)

---

## Quality Report Findings (2026-01-26)

> **Source**: Comprehensive quality review across 5 sections (Security, Architecture, Observability, Reliability, Testing)
> **Overall Score**: 7.5/10 - Production Ready with Refinements Needed

### 🟠 HIGH Priority Issues

#### OBS-PERF-001: Synchronous SQLite Blocking Event Loop

**Severity**: 🟠 HIGH
**Location**: `src/repositories/metrics.ts`, `src/utils/auditTrail.ts`

**Observation**: `better-sqlite3` is synchronous and blocks the Node.js event loop on heavy queries.

**Impact**: Performance degradation under load, blocked concurrent requests.

**Remediation**: Migrate to better-sqlite3 with worker threads OR sqlite3 (async) OR PostgreSQL for production.

**Estimated Effort**: 4-6 hours

---

#### TEST-FLAKY-001: Flaky TTL Tests Using setTimeout

**Severity**: 🟠 HIGH
**Location**: `tests/unit/workflows/cache.test.ts`

**Observation**: TTL tests use `setTimeout` for timing, causing flaky results and slow test suite.

**Impact**: CI failures, unreliable test outcomes, slow test suite.

**Remediation**: Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()`.

**Estimated Effort**: 30 minutes

---

#### OBS-LEAK-001: File Descriptor Exhaustion Risk

**Severity**: 🟠 HIGH
**Location**: `src/utils/structuredLogger.ts`

**Observation**: Logger creates streams per category without pooling, potentially exhausting file descriptors.

**Impact**: May exhaust file descriptors under heavy logging.

**Remediation**: Implement stream pooling or rotate streams more aggressively.

**Estimated Effort**: 2-3 hours

---

### 🟡 MEDIUM Priority Issues

#### ARCH-DI-001: Global Singleton Dependencies

**Severity**: 🟡 MEDIUM
**Location**: `src/dependencies.ts`

**Observation**: Singleton dependencies pattern with global state makes unit testing harder.

**Impact**: Unit testing requires global state management.

**Remediation**: Implement proper DI container (tsyringe/inversify).

**Estimated Effort**: 8-12 hours

---

#### REL-RACE-001: Circuit Breaker HALF_OPEN Race Condition

**Severity**: 🟡 MEDIUM
**Location**: `src/utils/circuitBreaker.ts`

**Observation**: Concurrent requests in HALF_OPEN state may cause incorrect state transitions.

**Impact**: Unreliable circuit breaker behavior under concurrent load.

**Remediation**: Add mutex lock around state transitions.

**Estimated Effort**: 2 hours

---

#### REL-VULN-001: Path Traversal in Overthinker outputFile

**Severity**: 🟡 MEDIUM
**Location**: `src/workflows/overthinker.workflow.ts`

**Observation**: User-controlled `outputFile` parameter allows writing files outside `.unitai/` directory.

**Impact**: Security vulnerability - files can be written outside intended directory.

**Remediation**: Use `pathValidator.validatePath()` before file writes.

**Estimated Effort**: 1 hour

---

#### REL-PARSE-001: Fragile Git Output Parsing

**Severity**: 🟡 MEDIUM
**Location**: `src/utils/gitHelper.ts`

**Observation**: Git output parsing relies on `split('|')` without validation.

**Impact**: Git commit messages containing `|` character will break parsing.

**Remediation**: Use `--format` with null-delimiters (`%x00`) or JSON.

**Estimated Effort**: 2 hours

---

#### OBS-RACE-002: Cache Concurrent Read-Write Issues

**Severity**: 🟡 MEDIUM
**Location**: `src/workflows/cache.ts`

**Observation**: Write lock only prevents concurrent writes, not read-during-write.

**Impact**: Potential data corruption during concurrent access.

**Remediation**: Implement read-write lock (RWLock) pattern.

**Estimated Effort**: 3 hours

---

#### TEST-TYPE-001: metrics.test.ts Uses `as any`

**Severity**: 🟡 MEDIUM
**Location**: `tests/unit/repositories/metrics.test.ts`

**Observation**: Type safety bypassed in database row reads using `as any`.

**Impact**: Reduced compile-time safety.

**Remediation**: Define `RedMetricRow` interface.

**Estimated Effort**: 15 minutes

---

#### TEST-INCON-001: Test Expects `rate` but Code Returns `errorRate`

**Severity**: 🟡 MEDIUM
**Location**: `tests/unit/repositories/metrics.test.ts`

**Observation**: Test passes but property name mismatch suggests miscommunication.

**Impact**: Confusing test assertions, potential bugs masked.

**Remediation**: Align property name in test.

**Estimated Effort**: 5 minutes

---

#### TEST-CACHE-001: Cache Key Doesn't Normalize Object Key Order

**Severity**: 🟡 MEDIUM
**Location**: `tests/unit/workflows/cache.test.ts`

**Observation**: `{a:1, b:2}` and `{b:2, a:1}` produce different cache keys.

**Impact**: Cache misses for semantically identical objects.

**Remediation**: Sort object keys before `JSON.stringify`.

**Estimated Effort**: 1 hour

---

### 🟢 LOW Priority Issues

#### TEST-COV-001: Missing Combined Filter Tests

**Severity**: 🟢 LOW
**Location**: `tests/unit/repositories/metrics.test.ts`

**Observation**: SQL WHERE clause with multiple filters not fully tested.

**Remediation**: Add test case with component AND success filters.

**Estimated Effort**: 15 minutes

---

#### TEST-DRY-001: Repetitive Permission Tests

**Severity**: 🟢 LOW
**Location**: `tests/unit/permissionManager.test.ts`

**Observation**: Code duplication makes tests harder to maintain.

**Remediation**: Use `it.each()` parameterized tests.

**Estimated Effort**: 1 hour

---

#### REL-RETRY-001: No Retry Strategy for AI Backend Failures

**Severity**: 🟢 LOW
**Location**: `src/workflows/overthinker.workflow.ts` (and others)

**Observation**: Transient AI backend failures cause entire workflow to fail.

**Remediation**: Implement exponential backoff retry wrapper.

**Estimated Effort**: 4 hours

---

## Async Migration Test Failures (2026-02-02)

> **Context**: After migrating from synchronous to AsyncDatabase wrapper (commit ca8bf52), core test files for `auditTrail.test.ts` and `activityAnalytics.test.ts` were successfully fixed (64 tests passing). However, several other test files have pre-existing issues unrelated to async migration that need attention.

### TEST-ASYNC-001: CircuitBreaker Tests Failing (Async Migration Incomplete)

**Severity**: 🟡 MEDIUM
**Location**: `tests/unit/circuitBreaker.test.ts`

**Observation**: All 20 tests in `circuitBreaker.test.ts` are failing due to incomplete async migration. The CircuitBreaker was migrated to use AsyncDatabase, but the tests were not updated accordingly.

**Error Patterns**:
- `isAvailable()` returns Promise instead of boolean (tests expect synchronous value)
- Database operations using synchronous `prepare().run()/.get()` instead of async methods
- Missing `await` on async database operations

**Sample Errors**:
```
expected Promise{…} to be true // Object.is equality
expected undefined to be 'CLOSED' // Object.is equality
expected undefined to be defined
```

**Context**: CircuitBreaker class was migrated to use AsyncDatabase as part of the async database refactor (commit ca8bf52), but test file was not updated to match.

**Impact**:
- CircuitBreaker functionality cannot be verified
- Regression risk if circuit breaker is broken
- Test suite shows 20 failures

**Remediation**:
1. Update test to use MockAsyncDatabase from `testDependencies.ts`
2. Make all test cases async
3. Add `await` to all `isAvailable()`, database operations
4. Update assertions to handle async returns

**Estimated Effort**: 2-3 hours

---

### TEST-ASYNC-002: Dependencies Tests Failing (Missing AsyncDatabase Support)

**Severity**: 🟡 MEDIUM
**Location**: `tests/unit/dependencies.test.ts`

**Observation**: 11 out of 17 tests in `dependencies.test.ts` are failing due to incomplete async migration support in the dependencies module.

**Error Patterns**:
- "Dependencies not initialized. Call initializeDependencies() first."
- "Failed to load url ../../src/utils/circuitBreaker.js"
- "Cannot read properties of undefined (reading 'shutdown')"
- Expected 4 database spy calls but got 0

**Sample Errors**:
```
expected Promise{…} to have property "activityDb"
expected "spy" to be called 4 times, but got 0 times
Cannot set properties of undefined (setting 'shutdown')
```

**Context**: The `dependencies.ts` module manages database connections and circuit breaker initialization. After async migration, the initialization and lifecycle management may not be properly handling AsyncDatabase instances.

**Impact**:
- Core dependency injection system cannot be verified
- Risk of production issues with database lifecycle
- 11 test failures blocking CI

**Remediation**:
1. Update `dependencies.ts` to properly support AsyncDatabase
2. Update test mocks to handle async database creation
3. Fix circuit breaker initialization with AsyncDatabase
4. Update cleanup logic for async database closing

**Estimated Effort**: 3-4 hours

---

### TEST-ENV-001: GitHelper Tests Environment-Dependent

**Severity**: 🟢 LOW
**Location**: `tests/unit/gitHelper.test.ts`

**Observation**: 9 out of 13 tests in `gitHelper.test.ts` are failing because they make assumptions about the git repository state that don't match the actual environment.

**Error Patterns**:
- Expected branch 'main' but got 'feat/di-lifecycle' (actual current branch)
- Expected specific commit hashes ('abc123') but got real commit hashes
- Expected staged changes that don't exist in the test environment
- Tests run in actual git repo instead of isolated test environment

**Sample Errors**:
```
expected 'feat/di-lifecycle' to be 'main'
expected 'ca8bf52c567d4a75dbc07bb2ad9c948c031c1d77' to be 'abc123'
expected '' to contain '+new code'
expected true to be false // isGitRepository check
```

**Context**: GitHelper tests appear to be integration tests that rely on specific git repository states rather than using mocked git operations or isolated test repositories.

**Impact**:
- Flaky tests depending on repository state
- Tests fail when run on feature branches
- Cannot be run in clean/isolated environments
- 9 test failures (but not blocking core functionality)

**Remediation**:
1. Mock git command execution using spies/stubs
2. Create isolated test git repositories in temp directories
3. Remove assumptions about specific branch names, commit hashes
4. Use vitest's `beforeEach` to set up controlled git state
5. Consider moving these to integration test suite

**Estimated Effort**: 4-5 hours

---

## Summary Table

| ID | Category | Severity | Location | Status |
|----|----------|----------|----------|--------|
| **SECURITY ISSUES (Audit: 2026-01-24)** |
| ~~SEC-001~~ | Security | 🔴 CRITICAL | `detectBackends.ts:56-62` | ✅ RESOLVED |
| ~~SEC-002~~ | Security | 🔴 CRITICAL | `cli/commandExecutor.ts:45-60` | ✅ RESOLVED |
| ~~SEC-003~~ | Security | 🔴 CRITICAL | Multiple workflows | ✅ RESOLVED |
| ~~SEC-004~~ | Security | 🟠 HIGH | `aiExecutor.ts:120-135` | ✅ RESOLVED |
| ~~SEC-005~~ | Security | 🟠 HIGH | `aiExecutor.ts` (all) | ✅ RESOLVED |
| ~~SEC-006~~ | Security | 🟡 MEDIUM | `aiExecutor.ts`, `server.ts` | ✅ RESOLVED |
| **SECURITY ISSUES (Audit: 2026-02-02)** |
| SEC-007 | Security | 🔴 CRITICAL | `DroidBackend.ts`, `CursorBackend.ts` | 🔶 OPEN |
| SEC-008 | Security | 🔴 CRITICAL | `DroidBackend.ts` | 🔶 OPEN |
| SEC-009 | Security | 🔴 CRITICAL | `CursorBackend.ts` | 🔶 OPEN |
| SEC-010 | Security | 🟠 HIGH | All backend executors | 🔶 OPEN |
| SEC-011 | Security | 🟠 HIGH | `backends/types.ts` | 🔶 OPEN |
| **BACKEND & RELIABILITY** |
| ARCH-BACKEND-001 | Backend | 🔴 CRITICAL | `aiExecutor.ts` + all backends | ⚠️ MOSTLY RESOLVED |
| **OBSERVABILITY (Layer 5 Audit)** |
| ~~OBS-001~~ | Audit | 🔴 CRITICAL | `security/permissionManager.ts` | ✅ RESOLVED |
| ~~OBS-002~~ | Cache | 🟠 HIGH | `cache.ts` | ✅ RESOLVED |
| ~~OBS-003~~ | Error | 🟡 MEDIUM | `overthinker.workflow.ts` | ✅ RESOLVED |
| ~~OBS-004~~ | File I/O | 🟡 MEDIUM | `overthinker.workflow.ts` | ✅ RESOLVED |
| ~~OBS-005~~ | I18n | ⚪ LOW | `gitHelper.ts` | ✅ RESOLVED |
| **QUALITY REPORT (2026-01-26)** |
| ~~OBS-PERF-001~~ | Performance | 🟠 HIGH | `metrics.ts`, `auditTrail.ts` | ✅ RESOLVED (Sprint 1) |
| ~~TEST-FLAKY-001~~ | Testing | 🟠 HIGH | `cache.test.ts` | ✅ RESOLVED (Sprint 1) |
| ~~OBS-LEAK-001~~ | Resources | 🟠 HIGH | `structuredLogger.ts` | ✅ RESOLVED (Sprint 1) |
| ARCH-DI-001 | Architecture | 🟡 MEDIUM | `dependencies.ts` | 🔶 OPEN |
| ~~REL-RACE-001~~ | Reliability | 🟡 MEDIUM | `reliability/circuitBreaker.ts` | ✅ RESOLVED (Sprint 2) |
| ~~REL-VULN-001~~ | Security | 🟡 MEDIUM | `overthinker.workflow.ts` | ✅ RESOLVED (Sprint 2) |
| REL-PARSE-001 | Reliability | 🟡 MEDIUM | `cli/gitHelper.ts` | 🔶 OPEN |
| ~~OBS-RACE-002~~ | Concurrency | 🟡 MEDIUM | `cache.ts` | ✅ RESOLVED (Sprint 2) |
| TEST-TYPE-001 | Testing | 🟡 MEDIUM | `metrics.test.ts` | 🔶 OPEN |
| TEST-INCON-001 | Testing | 🟡 MEDIUM | `metrics.test.ts` | 🔶 OPEN |
| TEST-CACHE-001 | Testing | 🟡 MEDIUM | `cache.test.ts` | 🔶 OPEN |
| TEST-COV-001 | Testing | 🟢 LOW | `metrics.test.ts` | 🔶 OPEN |
| TEST-DRY-001 | Testing | 🟢 LOW | `permissionManager.test.ts` | 🔶 OPEN |
| REL-RETRY-001 | Reliability | 🟢 LOW | Multiple workflows | 🔶 OPEN |
| **CODE QUALITY** |
| ~~Logger Init~~ | Lifecycle | 🟡 MEDIUM | `structuredLogger.ts` | ✅ RESOLVED |
| ~~Type Safety~~ | Quality | 🟡 MEDIUM | Multiple files | ⚠️ PARTIAL (11/70 fixed) |
| **DEPENDENCY INJECTION** |
| ~~DI-001~~ | DI | High | `auditTrail.ts:75` | ✅ RESOLVED |
| ~~DI-002~~ | DI | High | `activityAnalytics.ts:101` | ✅ RESOLVED |
| **TESTING** |
| ~~TEST-001~~ | Testing | High | `activityAnalytics.test.ts` | ✅ RESOLVED |
| **CONFIGURATION** |
| CFG-001 | Config | Medium | `config.ts:136` | 🔶 OPEN |
| CFG-002 | Config | Low | `detectBackends.ts:56-62` | 🔶 OPEN |
| CFG-003 | Config | Low | `triangulated-review.workflow.ts:46` | 🔶 OPEN |
| **LIFECYCLE** |
| ~~LCY-001~~ | Lifecycle | Medium | `server.ts` | ✅ RESOLVED |
| LCY-002 | Lifecycle | Low | `modelSelector.ts:91` | 🔶 OPEN |
| ~~LCY-003~~ | Lifecycle | Low | `reliability/circuitBreaker.ts` | ✅ RESOLVED |
| **CODE ORGANIZATION** |
| ORG-001 | Organization | Low | `constants.ts`, `aiExecutor.ts` | 🔶 OPEN |
| ORG-002 | Organization | Low | `constants.ts:127-148` | 🔶 OPEN |
| MISC-001 | Organization | Medium | `src/backends/` | 🔶 OPEN |
| **ASYNC MIGRATION (Audit: 2026-02-02)** |
| TEST-ASYNC-001 | Testing | 🟡 MEDIUM | `circuitBreaker.test.ts` | 🔶 OPEN |
| TEST-ASYNC-002 | Testing | 🟡 MEDIUM | `dependencies.test.ts` | 🔶 OPEN |
| TEST-ENV-001 | Testing | 🟢 LOW | `gitHelper.test.ts` | 🔶 OPEN |

**Progress**: 27/48 issues resolved (56%)
**Security Status**: 🔴 **NEW CRITICAL SECURITY ISSUES DISCOVERED** (5 new issues, 3 CRITICAL)
**Production Ready**: ⚠️ **CONDITIONAL** - ARCH-BACKEND-001 core bug fully resolved (22 new tests passing). Security vulnerabilities (SEC-007-011) remain.
**Async Migration Status**: ✅ **Core tests passing** (auditTrail: 32/32, activityAnalytics: 20/20, aiExecutor: 12/12) - Secondary test failures documented above.

---

## Related Documents

- `ssot_unitai_architecture_2026-01-24.md` - System architecture
- `ssot_unitai_security_audit_2026-01-24.md` - Security audit report
- `quality_report.md` - Full quality review source

