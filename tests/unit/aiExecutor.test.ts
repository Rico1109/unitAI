
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BACKENDS } from '../../src/constants.js';

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
  },
  metricsDb: {},
  recordMetric: vi.fn(),
  validateFilePaths: vi.fn(paths => paths.map(p => `/abs/${p}`)),
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

// Mock pathValidator (to avoid FS access)
vi.mock('../../src/utils/security/pathValidator.js', () => ({
  validateFilePaths: mocks.validateFilePaths,
  validateFilePath: vi.fn()
}));

// Import subject under test
import {
  executeAIClient,
  AIExecutionOptions
} from '../../src/services/ai-executor.js';

describe('AIExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup circuit breaker mock after clearAllMocks resets return values
    mocks.circuitBreaker.get.mockReturnValue({
      isAvailable: vi.fn().mockReturnValue(true),
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    });
    mocks.executeCommand.mockResolvedValue('Mock Response');
  });

  describe('executeAIClient (Gemini Backend)', () => {
    it('should execute gemini with basic prompt', async () => {
      mocks.executeCommand.mockResolvedValue('Gemini response');
      const result = await executeAIClient({ backend: BACKENDS.GEMINI, prompt: 'Test prompt' });

      expect(mocks.executeCommand).toHaveBeenCalled();
      expect(result).toBe('Gemini response');
    });

    it('should execute gemini with prompt as positional argument', async () => {
      await executeAIClient({ backend: BACKENDS.GEMINI, prompt: 'Test prompt' });

      const callArgs = mocks.executeCommand.mock.calls[0][1];
      expect(callArgs).toContain('Test prompt');
    });
  });

  describe('executeAIClient (Cursor Backend)', () => {
    it('should execute cursor agent with default options', async () => {
      mocks.executeCommand.mockResolvedValue('Cursor response');
      const result = await executeAIClient({ backend: BACKENDS.CURSOR, prompt: 'Fix bug' });

      expect(mocks.executeCommand).toHaveBeenCalled();
      expect(result).toBe('Cursor response');
    });

    it('should include attachments, force and output format flags', async () => {
      // Set up environment for auto-approve safeguards
      process.env.NODE_ENV = 'development';
      process.env.UNITAI_ALLOW_AUTO_APPROVE = 'true';

      await executeAIClient({
        backend: BACKENDS.CURSOR,
        prompt: 'Plan refactor',
        attachments: ['test-file.ts'],
        autoApprove: true,
        outputFormat: 'json',
        autonomyLevel: 'high' as any
      });

      const args = mocks.executeCommand.mock.calls[0][1];
      expect(args).toContain('--print');
      expect(args).toContain('--force');
      expect(args).toContain('--file');
      expect(args).toContain('/abs/test-file.ts');
      expect(args).toContain('--output-format');
      expect(args).toContain('json');

      // Clean up
      delete process.env.UNITAI_ALLOW_AUTO_APPROVE;
      delete process.env.NODE_ENV;
    });

    it('should block auto-approve when safeguards are not met', async () => {
      // Set up production environment (should block auto-approve)
      process.env.NODE_ENV = 'production';
      process.env.UNITAI_ALLOW_AUTO_APPROVE = 'true';

      await executeAIClient({
        backend: BACKENDS.CURSOR,
        prompt: 'Plan refactor',
        attachments: ['test-file.ts'],
        autoApprove: true,
        outputFormat: 'json',
        autonomyLevel: 'high' as any
      });

      const args = mocks.executeCommand.mock.calls[0][1];
      expect(args).toContain('--print');
      // Should NOT contain --force because safeguards block it in production
      expect(args).not.toContain('--force');
      expect(args).toContain('--file');
      expect(args).toContain('/abs/test-file.ts');
      expect(args).toContain('--output-format');
      expect(args).toContain('json');
      // Should log a warning
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Auto-approve request denied by safeguards')
      );

      // Clean up
      delete process.env.UNITAI_ALLOW_AUTO_APPROVE;
      delete process.env.NODE_ENV;
    });
  });

  describe('executeAIClient (Droid Backend)', () => {
    it('should execute droid with exec subcommand', async () => {
      mocks.executeCommand.mockResolvedValue('Droid response');
      const result = await executeAIClient({ backend: BACKENDS.DROID, prompt: 'Investigate issue' });

      expect(mocks.executeCommand).toHaveBeenCalled();
      expect(mocks.executeCommand.mock.calls[0][1][0]).toBe('exec');
      expect(result).toBe('Droid response');
    });

    it('should include auto level, session id and attachments embedded in prompt', async () => {
      await executeAIClient({
        backend: BACKENDS.DROID,
        prompt: 'Generate checklist',
        auto: 'medium',
        sessionId: 'session-123',
        skipPermissionsUnsafe: true,
        attachments: ['test-file.ts'],
        cwd: '/repo',
        outputFormat: 'json',
        autonomyLevel: 'high' as any
      });

      const args = mocks.executeCommand.mock.calls[0][1];
      expect(args).toContain('--auto');
      expect(args).toContain('medium');
      expect(args).toContain('--session-id');
      expect(args).toContain('session-123');
      expect(args).toContain('--skip-permissions-unsafe');
      // Droid now embeds files in prompt instead of using --file flag
      // (because Droid's --file means "read prompt FROM file", not "analyze this file")
      expect(args).not.toContain('--file');
      // File reference should be in the prompt argument (last arg)
      const promptArg = args[args.length - 1];
      expect(promptArg).toContain('[Files to analyze:');
      expect(promptArg).toContain('/abs/test-file.ts');
      expect(args).toContain('--cwd');
      expect(args).toContain('/repo');
      expect(args).toContain('--output-format');
      expect(args).toContain('json');
    });
  });

  describe('executeAIClient Routing', () => {
    it('should route to cursor backend', async () => {
      await executeAIClient({ backend: BACKENDS.CURSOR, prompt: 'Cursor prompt' });

      expect(mocks.executeCommand).toHaveBeenCalled();
      expect(mocks.executeCommand.mock.calls[0][0]).toBe('cursor-agent');
    });

    it('should route to droid backend', async () => {
      await executeAIClient({ backend: BACKENDS.DROID, prompt: 'Droid prompt' });

      expect(mocks.executeCommand).toHaveBeenCalled();
      expect(mocks.executeCommand.mock.calls[0][0]).toBe('droid');
    });

    it('should throw error for unknown backend', async () => {
      await expect(
        executeAIClient({ backend: 'unknown', prompt: 'Test' })
      ).rejects.toThrow(/Unsupported backend/);
    });

    it('should throw error for empty prompt', async () => {
      await expect(
        executeAIClient({ backend: BACKENDS.CURSOR, prompt: '' })
      ).rejects.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle command execution errors', async () => {
      mocks.executeCommand.mockRejectedValue(new Error('Command failed'));
      await expect(executeAIClient({ backend: BACKENDS.GEMINI, prompt: 'Test' })).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      mocks.executeCommand.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      await expect(executeAIClient({ backend: BACKENDS.GEMINI, prompt: 'Test' })).rejects.toThrow();
    });
  });
});
