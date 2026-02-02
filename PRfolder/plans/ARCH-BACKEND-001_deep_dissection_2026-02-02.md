# ARCH-BACKEND-001 Deep Dissection

## Executive Summary

**Status**: ⚠️ PARTIALLY RESOLVED - The transformation infrastructure exists but has **critical gaps** that make the fix incomplete.

**Core Issue**: Backend fallback system passes backend-specific options without semantic translation, causing failures when falling back between backends that interpret the same parameters differently.

**What Was Fixed**:
- ✅ Backend capability declaration system implemented (`fileMode` property)
- ✅ `transformOptionsForBackend()` function implemented
- ✅ Integration in fallback paths (`executeAIClient`)

**What's Still Broken**:
- 🔴 **No tests** for `transformOptionsForBackend()` 
- 🔴 **No tests** for fallback with attachments (the original bug scenario)
- 🔴 **Duplicate logic** between `transformOptionsForBackend()` and `DroidBackend.execute()`
- 🔴 **Hardcoded backend selection** in workflows (CFG-003)

---

## 1. Implementation Analysis

### 1.1 Capability Declaration System ✅

Each backend declares its `fileMode` capability:

```typescript
// src/backends/CursorBackend.ts
getCapabilities() {
  return {
    fileMode: 'cli-flag' as const  // --file means "analyze this file"
  };
}

// src/backends/DroidBackend.ts
getCapabilities() {
  return {
    fileMode: 'embed-in-prompt' as const  // --file means "read prompt FROM file"
  };
}

// src/backends/GeminiBackend.ts, QwenBackend.ts, RovodevBackend.ts
getCapabilities() {
  return {
    fileMode: 'none' as const  // No file support
  };
}
```

**Status**: ✅ Correctly implemented

---

### 1.2 Transform Function ✅ (But Untested)

```typescript
// src/utils/aiExecutor.ts:42-87
function transformOptionsForBackend(
  options: AIExecutionOptions,
  targetBackend: string
): AIExecutionOptions {
  const registry = BackendRegistry.getInstance();
  const executor = registry.getBackend(targetBackend);
  const capabilities = executor.getCapabilities();
  const { attachments = [], prompt, ...rest } = options;

  if (attachments.length > 0) {
    if (capabilities.fileMode === 'embed-in-prompt') {
      const fileList = attachments.join(', ');
      const transformedPrompt = `[Files to analyze: ${fileList}]\n\n${prompt}`;
      return {
        ...rest,
        prompt: transformedPrompt,
        attachments: [],  // Clear attachments
        backend: targetBackend
      };
    } else if (capabilities.fileMode === 'none') {
      // Same transformation for 'none' backends
      const fileList = attachments.join(', ');
      const transformedPrompt = `[Files to analyze: ${fileList}]\n\n${prompt}`;
      logger.warn(`Backend ${targetBackend} doesn't support files, embedding in prompt as fallback`);
      return {
        ...rest,
        prompt: transformedPrompt,
        attachments: [],
        backend: targetBackend
      };
    }
    // fileMode === 'cli-flag': pass attachments as-is
  }

  return { ...options, backend: targetBackend };
}
```

**Status**: ✅ Correctly implemented, 🔴 No unit tests

---

### 1.3 Fallback Integration ✅

```typescript
// src/utils/aiExecutor.ts:142-147
if (!(await circuitBreaker.isAvailable(backend))) {
  const fallback = await selectFallbackBackend(backend, circuitBreaker, config.triedBackends);
  return executeAIClient(
    transformOptionsForBackend(options, fallback),  // ✅ Transformation called
    { ...config, currentRetry: config.currentRetry + 1 }
  );
}
```

And at line 193-198 (when backend fails):
```typescript
if (config.currentRetry < config.maxRetries) {
  const fallback = await selectFallbackBackend(backend, circuitBreaker, config.triedBackends);
  return executeAIClient(
    transformOptionsForBackend(options, fallback),  // ✅ Transformation called
    { ...config, currentRetry: config.currentRetry + 1 }
  );
}
```

**Status**: ✅ Correctly integrated

---

## 2. The Duplicate Logic Problem 🔴

### 2.1 Double Transformation Risk

Both `transformOptionsForBackend()` AND `DroidBackend.execute()` handle attachment-to-prompt transformation:

**In aiExecutor.ts (transformOptionsForBackend):**
```typescript
if (capabilities.fileMode === 'embed-in-prompt') {
  const fileList = attachments.join(', ');
  const transformedPrompt = `[Files to analyze: ${fileList}]\n\n${prompt}`;
  return { ...rest, prompt: transformedPrompt, attachments: [] };
}
```

**In DroidBackend.ts (execute method):**
```typescript
async execute(options: BackendExecutionOptions): Promise<string> {
  const { attachments = [], prompt } = options;

  // For Droid, embed file references in the prompt
  let effectivePrompt = prompt;
  if (attachments.length > 0) {
    const validatedPaths = validateFilePaths(attachments);
    const fileList = validatedPaths.join(', ');
    effectivePrompt = `[Files to analyze: ${fileList}]\n\n${prompt}`;
  }
  // ... uses effectivePrompt
}
```

**Issue**: If `transformOptionsForBackend()` correctly clears `attachments`, then `DroidBackend.execute()` won't re-process them. But if the transformation is skipped or fails, DroidBackend has its own handling as a backup.

**This is NOT a bug** - it's defensive programming. But it creates:
1. Code duplication
2. Maintenance burden (two places to update)
3. Unclear responsibility (who owns the transformation?)

**Recommendation**: Remove duplicate logic from DroidBackend. The backend should expect ALREADY-TRANSFORMED options.

---

## 3. The Hardcoded Backend Problem 🔴

### 3.1 Workflow Hardcoding

**triangulated-review.workflow.ts:46-53**
```typescript
const analysisResult = await runParallelAnalysis(
  [BACKENDS.GEMINI, BACKENDS.CURSOR],  // ⚠️ HARDCODED
  promptBuilder,
  onProgress,
  (backend) => backend === BACKENDS.CURSOR
    ? { attachments: files.slice(0, 5), outputFormat: "text", trustedSource: true }
    : { trustedSource: true }
);
```

**Issues**:
1. **Ignores wizard configuration** - User might want Qwen instead of Cursor
2. **Assumes backends exist** - Crashes if neither backend is available
3. **Wastes retries** - Tries hardcoded backends even if unavailable

### 3.2 Fallback Priority Hardcoding

**modelSelector.ts:236-266**
```typescript
const fallbackOrder = [
  BACKENDS.GEMINI,
  BACKENDS.QWEN,
  BACKENDS.DROID,
  BACKENDS.ROVODEV
];
```

**Issues**:
1. **Ignores user preferences** - Wizard might configure different priorities
2. **Inefficient retries** - Tries unavailable backends before available ones
3. **No respect for circuit breaker state** - Could prioritize OPEN backends

---

## 4. Test Coverage Gaps 🔴

### 4.1 Missing Unit Tests

**tests/unit/aiExecutor.test.ts** - Only 2 tests, none cover:

| Test Case | Status | Priority |
|-----------|--------|----------|
| `transformOptionsForBackend()` basic functionality | ❌ Missing | 🔴 CRITICAL |
| Transform Cursor → Droid with attachments | ❌ Missing | 🔴 CRITICAL |
| Transform Cursor → Qwen with attachments | ❌ Missing | 🔴 CRITICAL |
| Transform Droid → Gemini with attachments | ❌ Missing | 🟠 HIGH |
| Fallback with circuit breaker OPEN | ❌ Missing | 🟠 HIGH |
| Fallback with all backends tried | ❌ Missing | 🟡 MEDIUM |

### 4.2 Missing Integration Tests

No tests for the actual bug scenario:
```typescript
// Scenario: triangulated-review with Cursor unavailable
// Expected: Falls back to Qwen/Gemini/Droid with transformed options
// Actual: Untested
```

---

## 5. Future Impact Analysis

### 5.1 Wizard Integration (Planned)

When the installation wizard allows users to:
- Enable/disable backends
- Set backend priorities
- Map backends to agent roles

**Current Problems**:
1. Workflows ignore wizard config (hardcoded backends)
2. Fallback ignores wizard priorities (hardcoded order)
3. No validation that selected backends support required features

### 5.2 Plugin System (Already Implemented)

New backends can be registered dynamically, but:
1. No guidance on implementing `getCapabilities()` correctly
2. No tests for fallback to plugin backends
3. Documentation doesn't explain the transformation system

---

## 6. Bug Scenario Walkthrough

### Scenario: Triangulated Review with Cursor Unavailable

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Workflow calls runParallelAnalysis([GEMINI, CURSOR], ...) │
│    with Cursor options: { attachments: [...], ... }         │
├─────────────────────────────────────────────────────────────┤
│ 2. runAIAnalysis(CURSOR, prompt, { attachments: [...] })    │
├─────────────────────────────────────────────────────────────┤
│ 3. executeAIClient({ backend: CURSOR, attachments: [...] }) │
├─────────────────────────────────────────────────────────────┤
│ 4. Circuit breaker check: Is Cursor available?             │
│    ✅ Yes (not in circuit breaker)                         │
├─────────────────────────────────────────────────────────────┤
│ 5. executor.execute(options) → Cursor.execute()             │
│    ❌ FAILS: "spawn cursor-agent ENOENT"                   │
├─────────────────────────────────────────────────────────────┤
│ 6. circuitBreaker.onFailure(CURSOR)                        │
├─────────────────────────────────────────────────────────────┤
│ 7. Retry logic: selectFallbackBackend(CURSOR, ...)         │
│    → Returns: GEMINI (first in priority order)             │
├─────────────────────────────────────────────────────────────┤
│ 8. executeAIClient(                                        │
│      transformOptionsForBackend({ attachments: [...] }, GEMINI), │
│      { currentRetry: 1 }                                   │
│    )                                                       │
├─────────────────────────────────────────────────────────────┤
│ 9. transformOptionsForBackend() for GEMINI:                │
│    - capabilities.fileMode === 'none'                      │
│    - Embeds attachments in prompt                          │
│    - Clears attachments array                              │
│    → Returns: { prompt: "[Files:...]\n\n...", attachments: [] } │
├─────────────────────────────────────────────────────────────┤
│ 10. executeAIClient({ backend: GEMINI, attachments: [] })  │
│     ❌ FAILS: "Gemini quota reached"                       │
├─────────────────────────────────────────────────────────────┤
│ 11. Retry logic: selectFallbackBackend(GEMINI, ...)        │
│     → Returns: QWEN (next in priority order)              │
├─────────────────────────────────────────────────────────────┤
│ 12. executeAIClient(                                       │
│      transformOptionsForBackend(original_options, QWEN),   │
│      { currentRetry: 2 }                                   │
│    )                                                       │
├─────────────────────────────────────────────────────────────┤
│ 13. ⚠️ POTENTIAL BUG: original_options still has attachments!│
│     If transformOptionsForBackend receives the original     │
│     Cursor options instead of the transformed Gemini ones, │
│     it will transform again (double embedding) or pass     │
│     raw attachments to Qwen.                               │
└─────────────────────────────────────────────────────────────┘
```

### The Actual Bug 🔴

Looking at the fallback code:

```typescript
// aiExecutor.ts:193-198
if (config.currentRetry < config.maxRetries) {
  const fallback = await selectFallbackBackend(backend, circuitBreaker, config.triedBackends);
  return executeAIClient(
    transformOptionsForBackend(options, fallback),  // ⚠️ 'options' is the ORIGINAL options!
    { ...config, currentRetry: config.currentRetry + 1 }
  );
}
```

**The bug**: `options` is the **original** options passed to `executeAIClient`, not the transformed options from the previous retry.

**Impact**:
- Retry 1: Cursor fails → Transform to Gemini → Gemini fails
- Retry 2: Transform **original Cursor options** to Qwen (not the transformed Gemini options)
- Result: Double embedding or wrong options passed

**The fix should be**: Track transformed options and pass those to subsequent retries.

---

## 7. Recommended Fixes

### 7.1 CRITICAL: Fix the Options Tracking Bug 🔴

```typescript
// aiExecutor.ts - executeAIClient function
export async function executeAIClient(
  options: AIExecutionOptions,
  retryConfig?: RetryConfig
): Promise<string> {
  // Track the CURRENT transformed options, not the original
  let currentOptions = options;
  
  // ... existing code ...
  
  // In fallback path:
  if (config.currentRetry < config.maxRetries) {
    const fallback = await selectFallbackBackend(backend, circuitBreaker, config.triedBackends);
    
    // Transform CURRENT options, not original
    currentOptions = transformOptionsForBackend(currentOptions, fallback);
    
    return executeAIClient(
      currentOptions,
      { ...config, currentRetry: config.currentRetry + 1 }
    );
  }
}
```

### 7.2 CRITICAL: Add Tests 🔴

```typescript
// tests/unit/aiExecutor.test.ts
describe('transformOptionsForBackend', () => {
  it('should transform attachments for embed-in-prompt backends', () => {
    const options = {
      backend: BACKENDS.CURSOR,
      attachments: ['file1.ts', 'file2.ts'],
      prompt: 'Analyze this code'
    };
    
    const transformed = transformOptionsForBackend(options, BACKENDS.DROID);
    
    expect(transformed.attachments).toEqual([]);
    expect(transformed.prompt).toContain('[Files to analyze: file1.ts, file2.ts]');
  });
  
  it('should pass attachments as-is for cli-flag backends', () => {
    const options = {
      backend: BACKENDS.DROID,
      attachments: ['file1.ts'],
      prompt: 'Analyze'
    };
    
    const transformed = transformOptionsForBackend(options, BACKENDS.CURSOR);
    
    expect(transformed.attachments).toEqual(['file1.ts']);
  });
});

describe('executeAIClient fallback', () => {
  it('should transform options when falling back to embed-in-prompt backend', async () => {
    // Mock Cursor to fail, Droid to succeed
    // Verify Droid receives transformed options (no attachments)
  });
});
```

### 7.3 HIGH: Remove Duplicate Logic 🟠

```typescript
// DroidBackend.ts - execute method
async execute(options: BackendExecutionOptions): Promise<string> {
  const { attachments = [], prompt } = options;

  // Remove this duplication - expect already-transformed options
  // if (attachments.length > 0) {
  //   effectivePrompt = `[Files to analyze: ...]${prompt}`;
  // }
  
  // Instead, validate that attachments were properly handled upstream
  if (attachments.length > 0) {
    logger.warn(`Droid received attachments but should have received transformed prompt. This indicates a bug in the fallback system.`);
  }
  
  const effectivePrompt = prompt;  // Use prompt directly
  // ...
}
```

### 7.4 HIGH: Make Workflow Backend Selection Dynamic 🟠

```typescript
// triangulated-review.workflow.ts
import { getRoleBackend } from '../config/config.js';

export async function executeTriangulatedReview(params: TriangulatedReviewParams) {
  // Use configured backends instead of hardcoded
  const architectBackend = getRoleBackend('architect');  // From wizard
  const implementerBackend = getRoleBackend('implementer');
  
  const analysisResult = await runParallelAnalysis(
    [architectBackend, implementerBackend],  // Dynamic!
    promptBuilder,
    onProgress,
    optionsBuilder
  );
}
```

### 7.5 MEDIUM: Configurable Fallback Priority 🟡

```typescript
// modelSelector.ts
export async function selectFallbackBackend(
  failedBackend: string,
  circuitBreaker: CircuitBreaker,
  triedBackends: string[] = []
): Promise<string> {
  // Load from wizard config instead of hardcoded
  const config = loadConfig();
  const fallbackOrder = config.fallbackPriority || DEFAULT_FALLBACK_ORDER;
  
  // ... rest of logic
}
```

---

## 8. Verification Plan

### 8.1 Unit Tests (Priority: 🔴 CRITICAL)
- [ ] Test `transformOptionsForBackend()` for all fileMode types
- [ ] Test fallback with attachments for each backend combination
- [ ] Test options tracking through multiple retries

### 8.2 Integration Tests (Priority: 🔴 CRITICAL)
- [ ] Test triangulated-review with Cursor unavailable
- [ ] Test parallel-review with Gemini circuit-open
- [ ] Test bug-hunt with Droid fallback

### 8.3 Manual Testing (Priority: 🟠 HIGH)
- [ ] Run triangulated-review with only Qwen available
- [ ] Run parallel-review with dynamic backend selection
- [ ] Simulate quota exhaustion and verify fallback

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Double transformation breaks prompts | 🟠 MEDIUM | 🔴 HIGH | Add tests, track options properly |
| Hardcoded backends ignore wizard | 🔴 CERTAIN | 🟠 MEDIUM | Make selection dynamic |
| Fallback passes wrong options | 🔴 CERTAIN | 🔴 HIGH | Fix options tracking bug |
| New backends break fallback | 🟠 MEDIUM | 🟠 MEDIUM | Document capabilities system |
| Tests don't catch regressions | 🔴 CERTAIN | 🟠 MEDIUM | Add comprehensive test suite |

---

## 10. Conclusion

**ARCH-BACKEND-001 is PARTIALLY RESOLVED but has critical gaps:**

✅ **Works**:
- Capability declaration system
- Transform function implementation
- Fallback integration

❌ **Broken**:
- Options tracking bug (passes original options to each retry)
- No test coverage
- Duplicate logic
- Hardcoded backend selection

🔴 **CRITICAL PATH TO FULL RESOLUTION**:
1. Fix options tracking in `executeAIClient`
2. Add unit tests for `transformOptionsForBackend`
3. Add integration tests for fallback scenarios
4. Remove duplicate logic from backends
5. Make workflow backend selection dynamic

**Without these fixes, the bug IS still present** and will manifest when:
- Multiple fallback retries occur
- Dynamic backend selection is implemented
- Custom backends are registered via plugin system
