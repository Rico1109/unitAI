---
title: unitAI Critical Security Modules - Test Implementation Plan
version: 1.0.0
updated: 2026-01-24T23:07:00+01:00
scope: unitai-testing-p0
category: plan
subcategory: testing
domain: [testing, security, unit-tests]
source: testing audit + manual analysis
changelog:
  - 1.0.0 (2026-01-24): Initial test implementation plan for P0 security modules.
---

# Critical Security Modules - Test Implementation Plan

## Executive Summary

This plan addresses the **4 CRITICAL (P0)** security modules identified in the testing audit that currently have **ZERO test coverage**. These modules handle security-sensitive operations and MUST be tested before production deployment.

| Module | Priority | Current Coverage | Target | Test File |
|--------|----------|------------------|--------|-----------|
| `circuitBreaker.ts` | 🔴 P0 | 0% | 85%+ | `tests/unit/circuitBreaker.test.ts` |
| `commandExecutor.ts` | 🔴 P0 | 0% | 90%+ | `tests/unit/commandExecutor.test.ts` |
| `pathValidator.ts` | 🔴 P0 | 0% | 95%+ | `tests/unit/pathValidator.test.ts` |
| `promptSanitizer.ts` | 🔴 P0 | 0% | 95%+ | `tests/unit/promptSanitizer.test.ts` |

---

## 1. circuitBreaker.test.ts

**Priority:** 🔴 CRITICAL
**Target Coverage:** 85%+
**Complexity:** High (state machine + database persistence)

### Test Suites

#### Suite 1: State Transitions
Tests the core state machine logic.

```typescript
describe('State Transitions', () => {
  it('should start in CLOSED state')
  it('should transition CLOSED -> OPEN after threshold failures')
  it('should transition OPEN -> HALF_OPEN after timeout')
  it('should transition HALF_OPEN -> CLOSED on success')
  it('should transition HALF_OPEN -> OPEN on failure')
})
```

**Key Assertions:**
- Initial state is CLOSED with 0 failures
- After 3 failures (threshold), state becomes OPEN
- After 5 minutes (timeout), OPEN transitions to HALF_OPEN
- Success in HALF_OPEN resets to CLOSED
- Failure in HALF_OPEN returns to OPEN

#### Suite 2: Database Persistence
Tests state persistence across restarts (NEW in reliability improvements).

```typescript
describe('Database Persistence', () => {
  it('should load state from database on initialization')
  it('should save state on onSuccess()')
  it('should save state on onFailure()')
  it('should save state on transitionTo()')
  it('should persist final state on shutdown()')
  it('should clear database on reset()')
})
```

**Setup Requirements:**
- Use `testDependencies.createTestDependencies()` for in-memory SQLite
- Verify `circuit_breaker_state` table creation
- Test database state before/after operations

**Key Assertions:**
- `loadState()` restores backends from database rows
- Each state transition writes to database
- `shutdown()` persists all current states
- `reset()` deletes all database rows

#### Suite 3: Availability Checks
Tests the `isAvailable()` method logic.

```typescript
describe('Availability Checks', () => {
  it('should return true for CLOSED circuit')
  it('should return false for OPEN circuit')
  it('should return true for HALF_OPEN circuit (one trial)')
  it('should transition OPEN -> HALF_OPEN after timeout expires')
})
```

**Key Assertions:**
- CLOSED always returns true
- OPEN returns false until timeout
- HALF_OPEN returns true (allows trial request)
- Timeout calculation: `Date.now() - lastFailureTime > resetTimeoutMs`

---

## 2. commandExecutor.test.ts

**Priority:** 🔴 CRITICAL
**Target Coverage:** 90%+
**Complexity:** Medium (security validation logic)

### Test Suites

#### Suite 1: Command Whitelist
Tests the command validation against ALLOWED_COMMANDS.

```typescript
describe('Command Whitelist', () => {
  it('should allow whitelisted commands (gemini, git, npm)')
  it('should reject non-whitelisted commands')
  it('should execute allowed command successfully')
})
```

**Key Assertions:**
- Allowed: `gemini`, `git`, `npm`, `which`, `droid`, `qwen`, `cursor-agent`, `rovodev`, `acli`
- Rejected: `rm`, `curl`, `wget`, `python`, etc.
- Error message: `"Command not allowed: <command>"`

#### Suite 2: Argument Validation
Tests DANGEROUS_PATTERNS detection.

```typescript
describe('Argument Validation', () => {
  it('should reject arguments with semicolons (;)')
  it('should reject arguments with ampersands (&)')
  it('should reject arguments with backticks (`)')
  it('should allow pipe (|) since shell:false')  // NEW: pipe allowed
  it('should reject path traversal (../)')
  it('should allow safe arguments')
})
```

**Key Assertions:**
- Pattern `/[;&`]/` blocks dangerous metacharacters
- Pattern `/\.\.\//` blocks path traversal
- Pipe `|` is ALLOWED (safe with `shell: false`)
- Error: `"Dangerous argument pattern detected: <arg>"`

#### Suite 3: AI Backend Exemption
Tests that AI backends skip strict validation.

```typescript
describe('AI Backend Exemption', () => {
  it('should skip validation for AI backend commands')
  it('should allow special chars in AI prompts')
  it('should validate non-AI commands strictly')
})
```

**Key Assertions:**
- AI backends: `gemini`, `droid`, `qwen`, `cursor-agent`, `rovodev`, `acli`
- These commands can have ANY arguments (prompts with special chars)
- Non-AI commands still get strict validation

#### Suite 4: CWD Validation
Tests working directory validation.

```typescript
describe('CWD Validation', () => {
  it('should allow cwd within project')
  it('should reject cwd outside project')
  it('should reject cwd with path traversal')
  it('should use process.cwd() when cwd not provided')
})
```

**Setup Requirements:**
- Mock `spawn` with `vi.fn()` to avoid actual execution
- Test validation logic, not command execution

**Key Assertions:**
- CWD must be within `process.cwd()`
- Reject if `!resolved.startsWith(projectRoot)`
- Reject if CWD contains `..`
- Default to `process.cwd()` when undefined

---

## 3. pathValidator.test.ts

**Priority:** 🔴 CRITICAL
**Target Coverage:** 95%+
**Complexity:** Medium (multiple validation layers)

### Test Suites

#### Suite 1: Project Boundary
Tests enforcement of project root boundary.

```typescript
describe('Project Boundary', () => {
  it('should allow files within project directory')
  it('should reject files outside project directory')
  it('should resolve relative paths correctly')
})
```

**Key Assertions:**
- Valid: `src/utils/file.ts`, `tests/unit/test.ts`
- Invalid: `/tmp/file.ts`, `/home/user/file.ts`
- Error: `"File outside project directory: <path>"`

#### Suite 2: Path Traversal Detection
Tests detection of `..` sequences.

```typescript
describe('Path Traversal Detection', () => {
  it('should reject paths with .. sequences')
  it('should reject paths with multiple ../../../')
  it('should allow legitimate paths without traversal')
})
```

**Key Assertions:**
- Reject: `src/../../../etc/passwd`
- Reject: `../outside.ts`
- Allow: `src/utils/file.ts`
- Error: `"Path traversal detected: <path>"`

#### Suite 3: File Existence
Tests file existence validation.

```typescript
describe('File Existence', () => {
  it('should reject non-existent files')
  it('should accept existing files')
  it('should validate before size check')
})
```

**Setup Requirements:**
- Create temporary test files with `fs.writeFileSync()`
- Clean up in `afterEach()` with `fs.unlinkSync()`

**Key Assertions:**
- `existsSync()` must return true
- Error: `"File not found: <path>"`

#### Suite 4: File Size Limits
Tests MAX_FILE_SIZE enforcement (10MB).

```typescript
describe('File Size Limits', () => {
  it('should reject files over MAX_FILE_SIZE')
  it('should accept files under limit')
  it('should report correct size in error')
})
```

**Key Assertions:**
- Limit: 10 * 1024 * 1024 bytes (10MB)
- Error: `"File too large: <path> (<size> bytes, max 10485760 bytes)"`

#### Suite 5: Batch Validation
Tests `validateFilePaths()` array validation.

```typescript
describe('Batch Validation', () => {
  it('should validate array of paths')
  it('should fail on first invalid path')
  it('should return validated paths')
})
```

**Key Assertions:**
- Returns array of resolved paths
- Fails immediately on first invalid path
- Maps over input array

---

## 4. promptSanitizer.test.ts

**Priority:** 🔴 CRITICAL
**Target Coverage:** 95%+
**Complexity:** Medium (pattern matching logic)

### Test Suites

#### Suite 1: Blocking Patterns
Tests BLOCKING_PATTERNS that throw errors.

```typescript
describe('Blocking Patterns', () => {
  it('should block "ignore previous instructions"')
  it('should block "forget everything"')
  it('should block "disregard all previous"')
  it('should block "[SYSTEM]" injections')
  it('should throw error on blocked pattern')
  it('should allow with trustedSource flag')
})
```

**Key Assertions:**
- Patterns blocked:
  - `/ignore\s+(all\s+)?previous\s+instructions/gi`
  - `/forget\s+(everything|all|your\s+(rules|instructions))/gi`
  - `/disregard\s+(all\s+)?(previous|prior)\s+(instructions|rules|context)/gi`
  - `/system\s*:\s*role\s*=/gi`
  - `/\[SYSTEM\]/gi`
  - `/\{role:\s*"system"\}/gi`
- Error thrown: `"Security: Prompt injection attempt blocked: <pattern>"`
- `skipBlocking: true` bypasses blocking

#### Suite 2: Redaction Patterns
Tests REDACT_PATTERNS that replace dangerous content.

```typescript
describe('Redaction Patterns', () => {
  it('should redact "rm -rf" commands')
  it('should redact "sudo" commands')
  it('should redact exec() calls')
  it('should redact eval() calls')
  it('should redact os.system calls')
  it('should not redact with skipRedaction flag')
})
```

**Key Assertions:**
- Patterns redacted:
  - `rm -rf /` → `[REDACTED_DANGEROUS_COMMAND]`
  - `sudo apt install` → `[REDACTED_SUDO] apt install`
  - `exec(code)` → `[REDACTED_EXEC](code)`
  - `eval(code)` → `[REDACTED_EVAL](code)`
  - `os.system(...)` → `[REDACTED_OS_SYSTEM](...)`
- `skipRedaction: true` bypasses redaction

#### Suite 3: Warning Patterns
Tests WARNING_PATTERNS that flag suspicious content.

```typescript
describe('Warning Patterns', () => {
  it('should warn on "you are now"')
  it('should warn on "act as if"')
  it('should warn on "pretend to be"')
  it('should include warnings in result')
})
```

**Key Assertions:**
- Patterns warned:
  - `/you\s+are\s+now\s+a/gi`
  - `/act\s+as\s+(if\s+)?you\s+(are|were)/gi`
  - `/pretend\s+(to\s+be|you\s+are)/gi`
- Warnings array contains pattern sources

#### Suite 4: Length Truncation
Tests MAX_PROMPT_LENGTH enforcement (50,000 chars).

```typescript
describe('Length Truncation', () => {
  it('should truncate prompts over MAX_LENGTH')
  it('should include truncation warning')
  it('should not truncate short prompts')
})
```

**Key Assertions:**
- Limit: 50,000 characters
- Truncated to exactly 50,000 chars
- Warning: `"Prompt truncated to 50000 characters"`
- `truncated: true` in result

#### Suite 5: Trusted Source
Tests `SanitizationOptions` flags.

```typescript
describe('Trusted Source', () => {
  it('should skip blocking when trustedSource=true')
  it('should skip redaction when skipRedaction=true')
  it('should still process warnings even when trusted')
})
```

**Setup Requirements:**
- No special setup, pure function testing
- Test with various option combinations

**Key Assertions:**
- `{ skipBlocking: true }` allows blocked patterns
- `{ skipRedaction: true }` preserves dangerous content
- Warnings still generated regardless of flags

---

## Implementation Guidelines

### Testing Stack
- **Framework:** Vitest 2.1.8
- **Pattern:** AAA (Arrange-Act-Assert)
- **Mocking:** `vi.fn()`, `vi.mock()`
- **Coverage:** V8 native coverage

### File Structure
```
tests/unit/
├── circuitBreaker.test.ts       ← NEW
├── commandExecutor.test.ts      ← NEW
├── pathValidator.test.ts        ← NEW
└── promptSanitizer.test.ts      ← NEW
```

### Shared Utilities
- **Database:** `testDependencies.createTestDependencies()` (in-memory SQLite)
- **Progress:** `testHelpers.createMockProgressCallback()`
- **Cleanup:** Use `afterEach()` for file/DB cleanup

### Success Criteria
- [ ] All 4 test files created
- [ ] Coverage ≥ target for each module
- [ ] All tests pass (`npm test`)
- [ ] Coverage report (`npm run test:coverage`)
- [ ] No flaky tests (run 3x to verify)

---

## Execution Order

1. **pathValidator.test.ts** - Simplest, no database, good warm-up
2. **promptSanitizer.test.ts** - Pure functions, no mocks needed
3. **commandExecutor.test.ts** - Needs spawn mocking
4. **circuitBreaker.test.ts** - Most complex, needs database + timing

**Estimated Effort:** 6-8 hours for all 4 modules

---

## Related Documents

- `ssot_unitai_testing_2026-01-24.md` - Testing infrastructure audit
- `tests/README.md` - Testing guidelines and best practices
- `vitest.config.ts` - Test configuration
