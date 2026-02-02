# Implementation Prompt: Dynamic Backend Selection & Wizard Integration

## Context

This prompt addresses **CFG-003** and the **wizard integration** requirements for the unitAI project.

### Reference Documents
- `PRfolder/ssot/ssot_unitai_known_issues_2026-01-24.md` - See CFG-003
- `PRfolder/plans/ARCH-BACKEND-001_deep_dissection_2026-02-02.md` - See sections 3.1, 3.2, 5.1, 7.4, 7.5

### Problem Statement

Currently, workflows **hardcode backend selection** instead of using dynamically detected or wizard-configured backends. This causes:

1. **Qwen (and other backends) to never be executed** in workflows like triangulated-review
2. **Wizard configuration to be ignored** - Users can enable/disable backends but workflows don't care
3. **Inefficient retries** - Tries unavailable backends before available ones
4. **Maintenance burden** - Adding new backends requires updating every workflow

### Current State (Broken)

```typescript
// src/workflows/triangulated-review.workflow.ts:46-53
const analysisResult = await runParallelAnalysis(
  [BACKENDS.GEMINI, BACKENDS.CURSOR],  // ⚠️ HARDCODED - Qwen never used!
  promptBuilder,
  onProgress,
  (backend) => backend === BACKENDS.CURSOR
    ? { attachments: files.slice(0, 5), outputFormat: "text", trustedSource: true }
    : { trustedSource: true }
);
```

```typescript
// src/workflows/modelSelector.ts:236-266
const fallbackOrder = [
  BACKENDS.GEMINI,   // ⚠️ HARDCODED priority
  BACKENDS.QWEN,
  BACKENDS.DROID,
  BACKENDS.ROVODEV
];
```

```typescript
// src/config/config.ts - ~/.unitai/config.json structure
interface UnitAIConfig {
  backends: {
    gemini: { enabled: boolean };
    qwen: { enabled: boolean };
    droid: { enabled: boolean };
    cursor: { enabled: boolean };
    rovodev: { enabled: boolean };
  };
  roles: {
    architect: string;   // e.g., "ask-gemini"
    implementer: string; // e.g., "droid"
    tester: string;      // e.g., "ask-qwen"
  };
  // ⚠️ MISSING: fallbackPriority, workflowDefaults
}
```

### Desired State

```typescript
// Workflows use role-based or dynamic backend selection
const architectBackend = getRoleBackend('architect');     // From wizard
const implementerBackend = getRoleBackend('implementer'); // From wizard

const analysisResult = await runParallelAnalysis(
  [architectBackend, implementerBackend],  // ✅ Dynamic!
  promptBuilder,
  onProgress,
  optionsBuilder
);

// Fallback respects wizard configuration
const fallbackOrder = config.fallbackPriority || getDefaultFallbackOrder();
```

---

## Implementation Requirements

### Phase 1: Configuration Schema Extension

**File**: `src/config/config.ts`

1. Extend `UnitAIConfig` interface with:
   ```typescript
   interface UnitAIConfig {
     // ... existing fields ...
     
     // NEW: Fallback priority order (overrides hardcoded order)
     fallbackPriority?: string[];
     
     // NEW: Per-workflow backend overrides
     workflowDefaults?: {
       [workflowName: string]: {
         backends?: string[];           // Backends to use for this workflow
         maxParallel?: number;          // Max parallel backends
         timeout?: number;              // Timeout in ms
       };
     };
     
     // NEW: Backend availability preferences
     preferences?: {
       preferAvailable: boolean;        // Skip unavailable backends in priority
       retryWithFallback: boolean;      // Enable automatic fallback
     };
   }
   ```

2. Add `getDefaultFallbackOrder()` function:
   ```typescript
   export function getDefaultFallbackOrder(): string[] {
     return [
       BACKENDS.GEMINI,
       BACKENDS.QWEN,
       BACKENDS.DROID,
       BACKENDS.ROVODEV
     ];
   }
   ```

3. Add `getFallbackPriority()` function:
   ```typescript
   export function getFallbackPriority(): string[] {
     const config = loadConfig();
     return config.fallbackPriority || getDefaultFallbackOrder();
   }
   ```

4. Add `getWorkflowBackends()` function:
   ```typescript
   export function getWorkflowBackends(
     workflowName: string,
     defaultBackends: string[]
   ): string[] {
     const config = loadConfig();
     const workflowConfig = config.workflowDefaults?.[workflowName];
     
     if (workflowConfig?.backends) {
       // Validate all configured backends exist
       const available = BackendRegistry.getInstance().getRegisteredBackends();
       const valid = workflowConfig.backends.filter(b => available.includes(b));
       
       if (valid.length === 0) {
         logger.warn(`No valid backends configured for ${workflowName}, using defaults`);
         return defaultBackends;
       }
       
       return valid;
     }
     
     return defaultBackends;
   }
   ```

5. Add `filterAvailableBackends()` helper:
   ```typescript
   export async function filterAvailableBackends(
     backends: string[],
     circuitBreaker: CircuitBreaker
   ): Promise<string[]> {
     const config = loadConfig();
     
     // If preference is to skip unavailable, filter them out
     if (config.preferences?.preferAvailable) {
       const availability = await Promise.all(
         backends.map(async (backend) => ({
           backend,
           available: await circuitBreaker.isAvailable(backend)
         }))
       );
       
       return availability
         .filter((a) => a.available)
         .map((a) => a.backend);
     }
     
     return backends;
   }
   ```

---

### Phase 2: Update Model Selector

**File**: `src/workflows/modelSelector.ts`

1. Update `selectFallbackBackend()` to use wizard config:
   ```typescript
   import { getFallbackPriority } from '../config/config.js';
   
   export async function selectFallbackBackend(
     failedBackend: string,
     circuitBreaker: CircuitBreaker,
     triedBackends: string[] = []
   ): Promise<string> {
     // Use wizard-configured priority instead of hardcoded
     const fallbackOrder = getFallbackPriority();
     
     // Filter out failed, tried, and unavailable backends
     const availabilityChecks = await Promise.all(
       fallbackOrder
         .filter((b) => b !== failedBackend && !triedBackends.includes(b))
         .map(async (b) => ({
           backend: b,
           available: await circuitBreaker.isAvailable(b)
         }))
     );
     
     const available = availabilityChecks
       .filter((check) => check.available)
       .map((check) => check.backend);
     
     if (available.length > 0) {
       return available[0];
     }
     
     // Fallback to any untried backend even if circuit-open
     const anyOther = fallbackOrder.find(
       b => b !== failedBackend && !triedBackends.includes(b)
     );
     
     if (!anyOther) {
       throw new Error(
         `No fallback backends available. All backends tried: ${[...triedBackends, failedBackend].join(', ')}`
       );
     }
     
     return anyOther;
   }
   ```

---

### Phase 3: Update Workflows

#### 3.1 Triangulated Review

**File**: `src/workflows/triangulated-review.workflow.ts`

```typescript
import { getRoleBackend, getWorkflowBackends, filterAvailableBackends } from '../config/config.js';
import { getDependencies } from '../dependencies.js';
import type { ProgressCallback } from '../domain/workflows/types.js';

export async function executeTriangulatedReview(
  params: TriangulatedReviewParams,
  onProgress?: ProgressCallback
): Promise<string> {
  const { files, goal } = params;
  
  // Get architect and implementer backends from wizard config
  const architectBackend = getRoleBackend('architect');
  const implementerBackend = getRoleBackend('implementer');
  
  // Get workflow-specific backend override or use role-based defaults
  const configuredBackends = getWorkflowBackends('triangulated-review', [
    architectBackend,
    implementerBackend
  ]);
  
  // Filter out unavailable backends (optional, based on preferences)
  const { circuitBreaker } = getDependencies();
  const availableBackends = await filterAvailableBackends(
    configuredBackends,
    circuitBreaker
  );
  
  if (availableBackends.length === 0) {
    throw new Error('No backends available for triangulated review');
  }
  
  onProgress?.(`🧭 Triangulated review avviata su ${files.length} file (goal: ${goal})`);
  onProgress?.(`Using backends: ${availableBackends.join(', ')}`);

  const promptBuilder = (backend: string): string => {
    const basePrompt = buildCodeReviewPrompt(files, goal === "bugfix" ? "security" : "quality");

    switch (backend) {
      case BACKENDS.GEMINI:
        return `${basePrompt}\n\nFocus:\n- Allineamento architetturale\n- Impatto a lungo termine rispetto all'obiettivo ${goal}`;
      case BACKENDS.CURSOR:
        return `${basePrompt}\n\nGenera suggerimenti concreti di refactoring con priorità e rischi residui.`;
      default:
        return basePrompt;
    }
  };

  // Dynamic options builder that checks backend capabilities
  const optionsBuilder = (backend: string) => {
    const registry = BackendRegistry.getInstance();
    const executor = registry.getBackend(backend);
    const capabilities = executor?.getCapabilities();
    
    const baseOptions = { trustedSource: true };
    
    // Only add attachments if backend supports files via CLI flag
    if (capabilities?.fileMode === 'cli-flag' && files.length > 0) {
      return {
        ...baseOptions,
        attachments: files.slice(0, 5),
        outputFormat: "text" as const
      };
    }
    
    return baseOptions;
  };

  const analysisResult = await runParallelAnalysis(
    availableBackends,
    promptBuilder,
    onProgress,
    optionsBuilder
  );
  
  // ... rest of function remains the same
}
```

#### 3.2 Parallel Review

**File**: `src/workflows/parallel-review.workflow.ts`

Apply similar changes:
```typescript
import { getWorkflowBackends, filterAvailableBackends } from '../config/config.js';

// In executeParallelReview function:
const configuredBackends = getWorkflowBackends('parallel-review', [
  BACKENDS.GEMINI,
  BACKENDS.CURSOR,
  BACKENDS.DROID
]);

const { circuitBreaker } = getDependencies();
const availableBackends = await filterAvailableBackends(
  configuredBackends,
  circuitBreaker
);

const analysisResult = await runParallelAnalysis(
  availableBackends.length > 2 ? availableBackends.slice(0, 3) : availableBackends,
  promptBuilder,
  onProgress,
  optionsBuilder
);
```

#### 3.3 Other Workflows to Update

| Workflow | File | Default Backends |
|----------|------|------------------|
| bug-hunt | `src/workflows/bug-hunt.workflow.ts` | `[GEMINI, CURSOR, DROID]` |
| feature-design | `src/workflows/feature-design.workflow.ts` | Use role-based |
| refactor-sprint | `src/workflows/refactor-sprint.workflow.ts` | `[CURSOR, GEMINI, DROID]` |
| pre-commit-validate | `src/workflows/pre-commit-validate.workflow.ts` | `[GEMINI, QWEN]` |

---

### Phase 4: Wizard CLI Updates

**File**: `src/cli/setup.tsx` (or equivalent wizard CLI)

1. Add backend priority selection step:
   ```typescript
   // Allow users to reorder fallback priority
   const stepFallbackPriority = {
     id: 'fallback-priority',
     prompt: 'Configure backend fallback priority (drag to reorder):',
     default: getDefaultFallbackOrder(),
     validate: (backends: string[]) => {
       const available = BackendRegistry.getInstance().getRegisteredBackends();
       const invalid = backends.filter(b => !available.includes(b));
       if (invalid.length > 0) {
         throw new Error(`Unknown backends: ${invalid.join(', ')}`);
       }
       return true;
     }
   };
   ```

2. Add per-workflow backend selection:
   ```typescript
   const stepWorkflowBackends = {
     id: 'workflow-backends',
     prompt: 'Configure default backends for workflows (optional):',
     workflows: [
       { name: 'triangulated-review', default: ['ask-gemini', 'ask-cursor'] },
       { name: 'parallel-review', default: ['ask-gemini', 'ask-cursor', 'droid'] },
       { name: 'bug-hunt', default: ['ask-gemini', 'ask-cursor', 'droid'] }
     ],
     optional: true
   };
   ```

3. Add preference toggles:
   ```typescript
   const stepPreferences = {
     id: 'preferences',
     prompts: [
       {
         name: 'preferAvailable',
         prompt: 'Skip unavailable backends in fallback order?',
         default: true,
         type: 'confirm'
       },
       {
         name: 'retryWithFallback',
         prompt: 'Enable automatic fallback on backend failure?',
         default: true,
         type: 'confirm'
       }
     ]
   };
   ```

4. Save configuration with new fields:
   ```typescript
   const config: UnitAIConfig = {
     // ... existing fields ...
     fallbackPriority: answers.fallbackPriority,
     workflowDefaults: answers.workflowBackends,
     preferences: answers.preferences
   };
   
   saveConfig(config);
   ```

---

### Phase 5: Tests

#### 5.1 Unit Tests

**File**: `tests/unit/config.test.ts` (create if doesn't exist)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWorkflowBackends, getFallbackPriority, filterAvailableBackends } from '../../src/config/config.js';

describe('Dynamic Backend Selection', () => {
  describe('getFallbackPriority', () => {
    it('should return configured priority', () => {
      vi.mock('../../src/config/config.js', () => ({
        loadConfig: () => ({
          fallbackPriority: ['droid', 'qwen', 'gemini']
        })
      }));
      
      const priority = getFallbackPriority();
      expect(priority).toEqual(['droid', 'qwen', 'gemini']);
    });
    
    it('should return default priority when not configured', () => {
      vi.mock('../../src/config/config.js', () => ({
        loadConfig: () => ({})
      }));
      
      const priority = getFallbackPriority();
      expect(priority).toEqual(['ask-gemini', 'ask-qwen', 'droid', 'rovodev']);
    });
  });
  
  describe('getWorkflowBackends', () => {
    it('should return configured backends for workflow', () => {
      vi.mock('../../src/config/config.js', () => ({
        loadConfig: () => ({
          workflowDefaults: {
            'triangulated-review': {
              backends: ['qwen', 'droid']
            }
          }
        })
      }));
      
      const backends = getWorkflowBackends('triangulated-review', ['ask-gemini', 'ask-cursor']);
      expect(backends).toEqual(['qwen', 'droid']);
    });
    
    it('should return default backends when workflow not configured', () => {
      vi.mock('../../src/config/config.js', () => ({
        loadConfig: () => ({})
      }));
      
      const backends = getWorkflowBackends('triangulated-review', ['ask-gemini', 'ask-cursor']);
      expect(backends).toEqual(['ask-gemini', 'ask-cursor']);
    });
    
    it('should filter out invalid backends', () => {
      vi.mock('../../src/config/config.js', () => ({
        loadConfig: () => ({
          workflowDefaults: {
            'triangulated-review': {
              backends: ['qwen', 'invalid-backend', 'droid']
            }
          }
        })
      }));
      
      vi.mock('../../src/utils/aiExecutor.js', () => ({
        BackendRegistry: {
          getInstance: () => ({
            getRegisteredBackends: () => ['ask-gemini', 'qwen', 'droid']
          })
        }
      }));
      
      const backends = getWorkflowBackends('triangulated-review', ['ask-gemini']);
      expect(backends).toEqual(['qwen', 'droid']); // 'invalid-backend' filtered out
    });
  });
  
  describe('filterAvailableBackends', () => {
    it('should filter out unavailable backends when preferAvailable is true', async () => {
      vi.mock('../../src/config/config.js', () => ({
        loadConfig: () => ({
          preferences: { preferAvailable: true }
        })
      }));
      
      const mockCircuitBreaker = {
        isAvailable: vi.fn()
      };
      mockCircuitBreaker.isAvailable.mockImplementation((backend) => {
        return Promise.resolve(backend === 'qwen' || backend === 'droid');
      });
      
      const available = await filterAvailableBackends(
        ['ask-gemini', 'qwen', 'droid'],
        mockCircuitBreaker
      );
      
      expect(available).toEqual(['qwen', 'droid']);
    });
    
    it('should return all backends when preferAvailable is false', async () => {
      vi.mock('../../src/config/config.js', () => ({
        loadConfig: () => ({
          preferences: { preferAvailable: false }
        })
      }));
      
      const mockCircuitBreaker = {
        isAvailable: vi.fn()
      };
      
      const backends = ['ask-gemini', 'qwen'];
      const available = await filterAvailableBackends(backends, mockCircuitBreaker);
      
      expect(available).toEqual(backends);
      expect(mockCircuitBreaker.isAvailable).not.toHaveBeenCalled();
    });
  });
});
```

#### 5.2 Integration Tests

**File**: `tests/integration/workflows/dynamic-backend-selection.test.ts` (create)

```typescript
import { describe, it, expect } from 'vitest';
import { executeTriangulatedReview } from '../../../src/workflows/triangulated-review.workflow.js';

describe('Workflow: Dynamic Backend Selection', () => {
  it('should use configured backends instead of hardcoded', async () => {
    // Mock config to use Qwen and Droid
    // Mock circuit breaker to make them available
    // Run triangulated review
    // Verify Qwen and Droid were called
  });
  
  it('should fallback to available backends when preferred is unavailable', async () => {
    // Mock config with Gemini as first choice
    // Mock circuit breaker to show Gemini as unavailable
    // Mock circuit breaker to show Qwen as available
    // Run workflow
    // Verify Qwen was used instead
  });
  
  it('should skip unavailable backends when preferAvailable is true', async () => {
    // Mock config with preferAvailable: true
    // Mock circuit breaker with Gemini unavailable, Qwen available
    // Run workflow
    // Verify Gemini was skipped, Qwen was used
  });
});
```

---

## Acceptance Criteria

### Must Have (Phase 1-3)

- [ ] Config schema extended with `fallbackPriority`, `workflowDefaults`, `preferences`
- [ ] `getFallbackPriority()` function implemented and tested
- [ ] `getWorkflowBackends()` function implemented and tested
- [ ] `filterAvailableBackends()` function implemented and tested
- [ ] `selectFallbackBackend()` updated to use wizard config
- [ ] `triangulated-review.workflow.ts` updated to use dynamic backends
- [ ] `parallel-review.workflow.ts` updated to use dynamic backends
- [ ] All other workflows updated with role-based or configured backends

### Should Have (Phase 4-5)

- [ ] Wizard CLI includes backend priority selection step
- [ ] Wizard CLI includes per-workflow backend configuration
- [ ] Wizard CLI includes preference toggles
- [ ] Unit tests for all new config functions
- [ ] Integration tests for dynamic backend selection
- [ ] Documentation updated with new config options

### Nice to Have

- [ ] Migration script to update existing configs
- [ ] CLI command to view current backend configuration
- [ ] CLI command to test backend availability
- [ ] Visual feedback in wizard showing which backends are available

---

## Backward Compatibility

**IMPORTANT**: Ensure backward compatibility with existing configs:

1. If `fallbackPriority` is not configured, use hardcoded default
2. If `workflowDefaults` is not configured, use workflow's hardcoded defaults
3. If `preferences` is not configured, assume `preferAvailable: false`
4. Existing configs should work without modification

---

## Testing Checklist

Before marking this complete, verify:

- [ ] Triangulated review works with only Qwen available
- [ ] Parallel review uses wizard-configured backends
- [ ] Fallback respects wizard priority order
- [ ] Circuit breaker state is respected when `preferAvailable: true`
- [ ] Invalid backends in config are filtered out gracefully
- [ ] Existing configs (without new fields) still work
- [ ] All existing tests still pass
- [ ] New tests cover happy path and edge cases

---

## Example Config Output

After implementation, `~/.unitai/config.json` should support:

```json
{
  "backends": {
    "gemini": { "enabled": true },
    "qwen": { "enabled": true },
    "droid": { "enabled": true },
    "cursor": { "enabled": false },
    "rovodev": { "enabled": true }
  },
  "roles": {
    "architect": "ask-gemini",
    "implementer": "droid",
    "tester": "ask-qwen"
  },
  "fallbackPriority": ["ask-qwen", "droid", "rovodev", "ask-gemini"],
  "workflowDefaults": {
    "triangulated-review": {
      "backends": ["ask-qwen", "rovodev"],
      "maxParallel": 2
    },
    "parallel-review": {
      "backends": ["ask-qwen", "droid", "rovodev"]
    }
  },
  "preferences": {
    "preferAvailable": true,
    "retryWithFallback": true
  }
}
```

---

## Notes for Implementation

1. **Start with Phase 1** - Config changes are foundational
2. **Test incrementally** - Don't wait until all workflows are updated
3. **Preserve existing behavior** - Dynamic selection should be opt-in initially
4. **Consider deprecation** - Document hardcoded backends as deprecated
5. **Update SSOT** - Mark CFG-003 as resolved when complete

---

## Related Issues

- **CFG-003**: Workflows Hardcode Backend Selection
- **ARCH-BACKEND-001**: Backend Parameter Semantic Mismatch (partially related)
- **MISC-001**: Phase 3 Roadmap Deviation (Backend Plugins vs Documentation)
