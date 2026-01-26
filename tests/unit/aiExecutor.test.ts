
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
    isAvailable: vi.fn().mockReturnValue(true),
    onSuccess: vi.fn(),
    onFailure: vi.fn(),
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
vi.mock('../../src/utils/commandExecutor.js', () => ({
  executeCommand: mocks.executeCommand
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger
}));

// Mock pathValidator (to avoid FS access)
vi.mock('../../src/utils/pathValidator.js', () => ({
  validateFilePaths: mocks.validateFilePaths,
  validateFilePath: vi.fn()
}));

// Import subject under test
import { 
  executeGeminiCLI, 
  executeCursorAgentCLI, 
  executeDroidCLI, 
  executeAIClient 
} from '../../src/utils/aiExecutor.js';

describe('AIExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.circuitBreaker.isAvailable.mockReturnValue(true);
    mocks.executeCommand.mockResolvedValue('Mock Response');
  });

  describe('executeGeminiCLI', () => {
    it('should execute gemini with basic prompt', async () => {
      mocks.executeCommand.mockResolvedValue('Gemini response');
      const result = await executeGeminiCLI({ prompt: 'Test prompt' });

      expect(mocks.executeCommand).toHaveBeenCalled();
      expect(result).toBe('Gemini response');
    });

    it('should execute gemini with prompt as positional argument', async () => {
      await executeGeminiCLI({ prompt: 'Test prompt' });

      const callArgs = mocks.executeCommand.mock.calls[0][1];
      expect(callArgs).toContain('Test prompt');
    });

    it('should throw error for empty prompt', async () => {
      await expect(executeGeminiCLI({ prompt: '' })).rejects.toThrow();
    });
  });

  describe('executeCursorAgentCLI', () => {
    it('should execute cursor agent with default options', async () => {
      mocks.executeCommand.mockResolvedValue('Cursor response');
      const result = await executeCursorAgentCLI({ prompt: 'Fix bug' });

      expect(mocks.executeCommand).toHaveBeenCalled();
      expect(result).toBe('Cursor response');
    });

    it('should include attachments, force and output format flags', async () => {
      await executeCursorAgentCLI({
        prompt: 'Plan refactor',
        attachments: ['test-file.ts'],
        autoApprove: true,
        outputFormat: 'json'
      });

      const args = mocks.executeCommand.mock.calls[0][1];
      expect(args).toContain('--print');
      expect(args).toContain('--force');
      expect(args).toContain('--file');
      expect(args).toContain('/abs/test-file.ts');
      expect(args).toContain('--output-format');
      expect(args).toContain('json');
    });
  });

  describe('executeDroidCLI', () => {
    it('should execute droid with exec subcommand', async () => {
      mocks.executeCommand.mockResolvedValue('Droid response');
      const result = await executeDroidCLI({ prompt: 'Investigate issue' });

      expect(mocks.executeCommand).toHaveBeenCalled();
      expect(mocks.executeCommand.mock.calls[0][1][0]).toBe('exec');
      expect(result).toBe('Droid response');
    });

    it('should include auto level, session id and attachments', async () => {
      await executeDroidCLI({
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
      expect(args).toContain('--file');
      expect(args).toContain('/abs/test-file.ts');
      expect(args).toContain('--cwd');
      expect(args).toContain('/repo');
      expect(args).toContain('--output-format');
      expect(args).toContain('json');
    });
  });

  describe('executeAIClient', () => {
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
      await expect(executeGeminiCLI({ prompt: 'Test' })).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      mocks.executeCommand.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      await expect(executeGeminiCLI({ prompt: 'Test' })).rejects.toThrow();
    });
  });
});
