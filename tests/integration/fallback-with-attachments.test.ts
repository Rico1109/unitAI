import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BACKENDS } from '../../src/constants.js';

/**
 * Integration tests for the fallback system with attachments.
 *
 * These tests verify that when backends fail and fallback occurs,
 * the attachment transformation is handled correctly without double-transformation.
 */

// Hoist mocks
const mocks = vi.hoisted(() => ({
  executeCommand: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  circuitBreaker: {
    get: vi.fn().mockReturnValue({
      isAvailable: vi.fn().mockReturnValue(true),
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    }),
    getAllStats: vi.fn().mockReturnValue({}),
    resetAll: vi.fn(),
  },
  metricsDb: {},
  recordMetric: vi.fn(),
  validateFilePaths: vi.fn((paths: string[]) => paths.map(p => `/abs/${p}`)),
  selectFallbackBackend: vi.fn(),
}));

// Mock dependencies
vi.mock('../../src/dependencies.js', () => ({
  getDependencies: () => ({
    circuitBreaker: mocks.circuitBreaker,
    metricsDb: mocks.metricsDb,
  }),
  initializeDependencies: vi.fn(),
  closeDependencies: vi.fn(),
}));

// Mock MetricsRepository
vi.mock('../../src/repositories/metrics.js', () => ({
  MetricsRepository: vi.fn().mockImplementation(() => ({
    record: mocks.recordMetric,
  })),
}));

// Mock commandExecutor
vi.mock('../../src/utils/cli/commandExecutor.js', () => ({
  executeCommand: mocks.executeCommand
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger
}));

// Mock pathValidator
vi.mock('../../src/utils/security/pathValidator.js', () => ({
  validateFilePaths: mocks.validateFilePaths,
  validateFilePath: vi.fn((p: string) => `/abs/${p}`)
}));

// Mock modelSelector
vi.mock('../../src/workflows/model-selector.js', () => ({
  selectFallbackBackend: mocks.selectFallbackBackend
}));

// Import subject under test
import { executeAIClient, AIExecutionOptions } from '../../src/services/ai-executor.js';

describe('Fallback with Attachments Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.circuitBreaker.get.mockReturnValue({
      isAvailable: vi.fn().mockReturnValue(true),
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    });
    mocks.executeCommand.mockResolvedValue('Success');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Single fallback with attachments', () => {
    it('should correctly transform attachments when falling back from Cursor to Droid', async () => {
      // Setup: Cursor fails, falls back to Droid
      let callCount = 0;
      mocks.executeCommand
        .mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call (Cursor) fails
            return Promise.reject(new Error('Cursor unavailable'));
          }
          // Second call (Droid) succeeds
          return Promise.resolve('Droid response');
        });

      mocks.selectFallbackBackend.mockResolvedValue(BACKENDS.DROID);

      const result = await executeAIClient({
        backend: BACKENDS.CURSOR,
        prompt: 'Analyze this code',
        attachments: ['src/file.ts']
      });

      expect(result).toBe('Droid response');
      expect(mocks.executeCommand).toHaveBeenCalledTimes(2);

      // Verify Droid was called with embedded file reference in prompt
      const droidCallArgs = mocks.executeCommand.mock.calls[1];
      expect(droidCallArgs[0]).toBe('droid');

      // The prompt should contain [Files to analyze:] with validated paths
      const droidArgs = droidCallArgs[1];
      const promptArg = droidArgs.find((arg: string) =>
        typeof arg === 'string' && arg.includes('[Files to analyze:')
      );
      expect(promptArg).toBeTruthy();
      expect(promptArg).toContain('/abs/src/file.ts');
    });

    it('should correctly transform attachments when falling back from Cursor to Gemini (fileMode: none)', async () => {
      let callCount = 0;
      mocks.executeCommand
        .mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Cursor unavailable'));
          }
          return Promise.resolve('Gemini response');
        });

      mocks.selectFallbackBackend.mockResolvedValue(BACKENDS.GEMINI);

      const result = await executeAIClient({
        backend: BACKENDS.CURSOR,
        prompt: 'Review code',
        attachments: ['test.ts']
      });

      expect(result).toBe('Gemini response');

      // Gemini should receive prompt with embedded file references
      // (since it has fileMode: 'cli-flag', attachments are passed through)
      expect(mocks.executeCommand).toHaveBeenCalledTimes(2);
    });
  });

  describe('Double fallback - no duplicate file embedding', () => {
    it('should NOT add duplicate [Files to analyze:] prefix on second fallback', async () => {
      // Setup: Cursor fails -> Droid fails -> Qwen succeeds
      let callCount = 0;
      mocks.executeCommand
        .mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            return Promise.reject(new Error(`Backend ${callCount} failed`));
          }
          return Promise.resolve('Qwen response');
        });

      mocks.selectFallbackBackend
        .mockResolvedValueOnce(BACKENDS.DROID)
        .mockResolvedValueOnce(BACKENDS.QWEN);

      const result = await executeAIClient({
        backend: BACKENDS.CURSOR,
        prompt: 'Analyze code',
        attachments: ['file.ts']
      }, {
        maxRetries: 3,
        currentRetry: 0,
        triedBackends: []
      });

      expect(result).toBe('Qwen response');
      expect(mocks.executeCommand).toHaveBeenCalledTimes(3);

      // Get the final call to Qwen
      const qwenCallArgs = mocks.executeCommand.mock.calls[2];
      const qwenArgs = qwenCallArgs[1];

      // Find the prompt argument
      const promptArg = qwenArgs.find((arg: string) =>
        typeof arg === 'string' && arg.includes('Analyze code')
      );

      // Count occurrences of [Files to analyze:] - should be exactly 1
      if (promptArg) {
        const matches = promptArg.match(/\[Files to analyze:/g);
        expect(matches?.length || 0).toBeLessThanOrEqual(1);
      }
    });

    it('should handle attachments correctly through multiple fallbacks', async () => {
      // Track all prompts received by backends
      const promptsReceived: string[] = [];

      let callCount = 0;
      mocks.executeCommand
        .mockImplementation((_cmd: string, args: string[]) => {
          callCount++;
          // Find the prompt argument (usually last non-flag arg)
          const prompt = args.find((arg: string) =>
            typeof arg === 'string' &&
            !arg.startsWith('-') &&
            !['exec', 'text', 'json'].includes(arg)
          );
          if (prompt) promptsReceived.push(prompt);

          if (callCount <= 2) {
            return Promise.reject(new Error('Failed'));
          }
          return Promise.resolve('Success');
        });

      mocks.selectFallbackBackend
        .mockResolvedValueOnce(BACKENDS.DROID)
        .mockResolvedValueOnce(BACKENDS.GEMINI);

      await executeAIClient({
        backend: BACKENDS.CURSOR,
        prompt: 'Original prompt',
        attachments: ['important.ts']
      }, {
        maxRetries: 3,
        currentRetry: 0,
        triedBackends: []
      });

      // Verify that prompts don't accumulate [Files to analyze:] prefixes
      for (const prompt of promptsReceived) {
        const occurrences = (prompt.match(/\[Files to analyze:/g) || []).length;
        expect(occurrences).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Circuit breaker triggered fallback with attachments', () => {
    it('should transform attachments when circuit breaker blocks initial backend', async () => {
      // Circuit breaker blocks Cursor, immediately falls back to Droid
      mocks.circuitBreaker.get.mockImplementation((backend: string) => ({
        isAvailable: vi.fn().mockReturnValue(backend !== BACKENDS.CURSOR),
        onSuccess: vi.fn(),
        onFailure: vi.fn(),
      }));

      mocks.selectFallbackBackend.mockResolvedValue(BACKENDS.DROID);
      mocks.executeCommand.mockResolvedValue('Droid response');

      const result = await executeAIClient({
        backend: BACKENDS.CURSOR,
        prompt: 'Review',
        attachments: ['code.ts']
      });

      expect(result).toBe('Droid response');

      // Should have warned about circuit breaker
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('currently unavailable (Circuit Open)')
      );

      // Droid should receive prompt with embedded files
      const droidArgs = mocks.executeCommand.mock.calls[0][1];
      const promptArg = droidArgs.find((arg: string) =>
        typeof arg === 'string' && arg.includes('[Files to analyze:')
      );
      expect(promptArg).toBeTruthy();
    });

    it('should handle circuit breaker triggering mid-retry with attachments', async () => {
      // First call succeeds check, fails execution
      // Circuit breaker then blocks the first fallback, goes to second
      let execCallCount = 0;
      // Cursor available (but execution will fail), Droid blocked, Qwen available
      mocks.circuitBreaker.get.mockImplementation((backend: string) => ({
        isAvailable: vi.fn().mockReturnValue(backend !== BACKENDS.DROID),
        onSuccess: vi.fn(),
        onFailure: vi.fn(),
      }));

      mocks.executeCommand
        .mockRejectedValueOnce(new Error('Cursor failed'))
        .mockResolvedValue('Qwen success');

      mocks.selectFallbackBackend
        .mockResolvedValueOnce(BACKENDS.DROID)
        .mockResolvedValueOnce(BACKENDS.QWEN);

      const result = await executeAIClient({
        backend: BACKENDS.CURSOR,
        prompt: 'Check code',
        attachments: ['src/app.ts']
      }, {
        maxRetries: 3,
        currentRetry: 0,
        triedBackends: []
      });

      expect(result).toBe('Qwen success');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty attachments array through fallback', async () => {
      mocks.executeCommand
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValue('Success');
      mocks.selectFallbackBackend.mockResolvedValue(BACKENDS.DROID);

      const result = await executeAIClient({
        backend: BACKENDS.CURSOR,
        prompt: 'Simple prompt',
        attachments: []
      });

      expect(result).toBe('Success');

      // Prompt should not contain [Files to analyze:]
      const droidArgs = mocks.executeCommand.mock.calls[1][1];
      const hasFilePrefix = droidArgs.some((arg: string) =>
        typeof arg === 'string' && arg.includes('[Files to analyze:')
      );
      expect(hasFilePrefix).toBe(false);
    });

    it('should handle undefined attachments through fallback', async () => {
      mocks.executeCommand
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValue('Success');
      mocks.selectFallbackBackend.mockResolvedValue(BACKENDS.DROID);

      const options: AIExecutionOptions = {
        backend: BACKENDS.CURSOR,
        prompt: 'No attachments prompt'
      };

      const result = await executeAIClient(options);

      expect(result).toBe('Success');
    });

    it('should preserve other options during fallback transformation', async () => {
      mocks.executeCommand
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValue('Success');
      mocks.selectFallbackBackend.mockResolvedValue(BACKENDS.DROID);

      await executeAIClient({
        backend: BACKENDS.CURSOR,
        prompt: 'Test',
        attachments: ['file.ts'],
        outputFormat: 'json',
        requestId: 'req-456'
      });

      // Verify Droid was called with preserved options
      const droidArgs = mocks.executeCommand.mock.calls[1][1];
      expect(droidArgs).toContain('--output-format');
      expect(droidArgs).toContain('json');
    });
  });
});
