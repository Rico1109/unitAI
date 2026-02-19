/**
 * Tests for model selector
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  selectOptimalBackend,
  selectParallelBackends,
  recordBackendUsage,
  getBackendStats,
  createTaskCharacteristics,
  type TaskCharacteristics
} from '../../../src/workflows/model-selector.js';
import { BACKENDS } from '../../../src/services/ai-executor.js';
import { CircuitBreakerRegistry } from '../../../src/utils/reliability/index.js';

// Mock config to ensure consistent role→backend mapping regardless of local config
vi.mock('../../../src/config/config.js', () => ({
  getRoleBackend: vi.fn().mockImplementation((role: string) => {
    const defaults: Record<string, string> = {
      architect: 'ask-gemini',
      implementer: 'ask-droid',
      tester: 'ask-qwen'
    };
    return defaults[role] ?? 'ask-gemini';
  }),
  isBackendEnabled: vi.fn().mockReturnValue(true),
  loadConfig: vi.fn().mockReturnValue(null),
  getFallbackPriority: vi.fn().mockReturnValue(['ask-gemini', 'ask-qwen', 'ask-droid']),
}));

// Mock dependencies to avoid real DB initialization
vi.mock('../../../src/dependencies.js', () => {
  const mockDb = {
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn()
    })),
    pragma: vi.fn(),
    exec: vi.fn()
  };

  return {
    initializeDependencies: vi.fn(),
    closeDependencies: vi.fn(),
    getDependencies: vi.fn().mockReturnValue({
      tokenDbSync: mockDb
    })
  };
});

describe('Model Selector', () => {
  let mockCB: CircuitBreakerRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCB = new CircuitBreakerRegistry();
  });

  describe('selectOptimalBackend', () => {
    it('should select Qwen for fast + low complexity tasks', async () => {
      const task: TaskCharacteristics = {
        complexity: 'low',
        tokenBudget: 5000,
        requiresArchitecturalThinking: false,
        requiresCodeGeneration: false,
        requiresSpeed: true,
        requiresCreativity: false
      };

      const backend = await selectOptimalBackend(task, mockCB);
      expect(backend).toBe(BACKENDS.QWEN);
    });

    it('should select Gemini for architectural thinking', async () => {
      const task: TaskCharacteristics = {
        complexity: 'high',
        tokenBudget: 50000,
        requiresArchitecturalThinking: true,
        requiresCodeGeneration: false,
        requiresSpeed: false,
        requiresCreativity: false
      };

      const backend = await selectOptimalBackend(task, mockCB);
      expect(backend).toBe(BACKENDS.GEMINI);
    });

    it('should select Droid for code generation + high complexity (implementer role)', async () => {
      const task: TaskCharacteristics = {
        complexity: 'high',
        tokenBudget: 40000,
        requiresArchitecturalThinking: false,
        requiresCodeGeneration: true,
        requiresSpeed: false,
        requiresCreativity: false
      };

      const backend = await selectOptimalBackend(task, mockCB);
      expect(backend).toBe(BACKENDS.DROID);
    });

    it('should select by domain: security -> Qwen', async () => {
      const task: TaskCharacteristics = {
        complexity: 'medium',
        tokenBudget: 20000,
        requiresArchitecturalThinking: false,
        requiresCodeGeneration: false,
        requiresSpeed: false,
        requiresCreativity: false,
        domain: 'security'
      };

      const backend = await selectOptimalBackend(task, mockCB);
      expect(backend).toBe(BACKENDS.QWEN);
    });

    it('should select by domain: architecture -> Gemini', async () => {
      const task: TaskCharacteristics = {
        complexity: 'medium',
        tokenBudget: 30000,
        requiresArchitecturalThinking: false,
        requiresCodeGeneration: false,
        requiresSpeed: false,
        requiresCreativity: false,
        domain: 'architecture'
      };

      const backend = await selectOptimalBackend(task, mockCB);
      expect(backend).toBe(BACKENDS.GEMINI);
    });

    it('should select by domain: debugging -> Qwen', async () => {
      const task: TaskCharacteristics = {
        complexity: 'medium',
        tokenBudget: 30000,
        requiresArchitecturalThinking: false,
        requiresCodeGeneration: false,
        requiresSpeed: false,
        requiresCreativity: false,
        domain: 'debugging'
      };

      const backend = await selectOptimalBackend(task, mockCB);
      expect(backend).toBe(BACKENDS.QWEN);
    });

    it('should respect allowed backends constraint', async () => {
      const task: TaskCharacteristics = {
        complexity: 'high',
        tokenBudget: 50000,
        requiresArchitecturalThinking: true,
        requiresCodeGeneration: false,
        requiresSpeed: false,
        requiresCreativity: false
      };

      // Only QWEN and DROID are allowed, so one of them should be selected
      const backend = await selectOptimalBackend(task, mockCB, [BACKENDS.QWEN, BACKENDS.DROID]);
      expect([BACKENDS.QWEN, BACKENDS.DROID]).toContain(backend);
    });
  });

  describe('selectParallelBackends', () => {
    it('should select 2 complementary backends', async () => {
      const task: TaskCharacteristics = {
        complexity: 'high',
        tokenBudget: 50000,
        requiresArchitecturalThinking: true,
        requiresCodeGeneration: false,
        requiresSpeed: false,
        requiresCreativity: false
      };

      const backends = await selectParallelBackends(task, mockCB, 2);
      expect(backends).toHaveLength(2);
      expect(new Set(backends).size).toBe(2); // No duplicates
    });

    it('should complement Gemini with Qwen', async () => {
      const task: TaskCharacteristics = {
        complexity: 'high',
        tokenBudget: 50000,
        requiresArchitecturalThinking: true,
        requiresCodeGeneration: false,
        requiresSpeed: false,
        requiresCreativity: false
      };

      const backends = await selectParallelBackends(task, mockCB, 2);
      expect(backends[0]).toBe(BACKENDS.GEMINI);
      expect(backends[1]).toBe(BACKENDS.QWEN);
    });

    it('should select up to 3 backends', async () => {
      const task: TaskCharacteristics = {
        complexity: 'high',
        tokenBudget: 50000,
        requiresArchitecturalThinking: false,
        requiresCodeGeneration: false,
        requiresSpeed: false,
        requiresCreativity: false
      };

      const backends = await selectParallelBackends(task, mockCB, 3);
      expect(backends.length).toBeLessThanOrEqual(3);
    });
  });

  describe('recordBackendUsage', () => {
    it('should record backend usage statistics', () => {
      const task: TaskCharacteristics = {
        complexity: 'medium',
        tokenBudget: 30000,
        requiresArchitecturalThinking: false,
        requiresCodeGeneration: false,
        requiresSpeed: false,
        requiresCreativity: false
      };

      recordBackendUsage(BACKENDS.GEMINI, task, true, 1500);
      recordBackendUsage(BACKENDS.GEMINI, task, true, 1600);
      recordBackendUsage(BACKENDS.GEMINI, task, false, 2000);

      const stats = getBackendStats();
      const geminiStats = stats.find(s => s.backend === BACKENDS.GEMINI);

      expect(geminiStats).toBeDefined();
      expect(geminiStats?.totalCalls).toBe(3);
      expect(geminiStats?.successfulCalls).toBe(2);
      expect(geminiStats?.failedCalls).toBe(1);
    });
  });

  describe('createTaskCharacteristics', () => {
    it('should create characteristics for parallel-review', () => {
      const task = createTaskCharacteristics('parallel-review');

      expect(task.complexity).toBe('high');
      expect(task.requiresArchitecturalThinking).toBe(true);
      expect(task.domain).toBe('architecture');
    });

    it('should create characteristics for pre-commit-validate', () => {
      const task = createTaskCharacteristics('pre-commit-validate');

      expect(task.requiresSpeed).toBe(true);
      expect(task.domain).toBe('security');
    });

    it('should create characteristics for bug-hunt', () => {
      const task = createTaskCharacteristics('bug-hunt');

      expect(task.complexity).toBe('high');
      expect(task.domain).toBe('debugging');
    });

    it('should apply custom overrides', () => {
      const task = createTaskCharacteristics('parallel-review', {
        complexity: 'low',
        requiresSpeed: true
      });

      expect(task.complexity).toBe('low');
      expect(task.requiresSpeed).toBe(true);
      expect(task.requiresArchitecturalThinking).toBe(true); // Preserved from default
    });
  });
});
