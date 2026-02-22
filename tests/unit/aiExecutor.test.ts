
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
  config: {
    security: { allowAutoApprove: false, allowPermissionBypass: false },
    runtime: { isProduction: false, isDevelopment: true, env: 'development' },
    logging: { level: 'info', toConsole: false, debug: false },
  },
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

// Mock config module (CONFIG is a frozen const, must be mocked at module level)
vi.mock('../../src/config.js', () => ({
  CONFIG: mocks.config,
  validateConfig: vi.fn(),
}));

// Mock pathValidator (to avoid FS access)
vi.mock('../../src/utils/security/pathValidator.js', () => ({
  validateFilePaths: mocks.validateFilePaths,
  validateFilePath: vi.fn()
}));

// Import subject under test
import {
  executeAIClient,
  transformOptionsForBackend,
  AIExecutionOptions
} from '../../src/services/ai-executor.js';
import { AutonomyLevel } from '../../src/utils/security/permissionManager.js';

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
      // Set up config for auto-approve safeguards
      mocks.config.security.allowAutoApprove = true;
      mocks.config.runtime.isProduction = false;

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
      mocks.config.security.allowAutoApprove = false;
      mocks.config.runtime.isProduction = false;
    });

    it('should block auto-approve when safeguards are not met', async () => {
      // Set up production config (should block auto-approve)
      mocks.config.security.allowAutoApprove = true;
      mocks.config.runtime.isProduction = true;

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
      mocks.config.security.allowAutoApprove = false;
      mocks.config.runtime.isProduction = false;
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
      // autonomyLevel: 'high' takes priority over explicit auto: 'medium'
      expect(args).toContain('high');
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

  describe('transformOptionsForBackend — autonomyLevel mapping', () => {
    const base: AIExecutionOptions = { backend: BACKENDS.DROID, prompt: 'test' };

    it('maps HIGH autonomyLevel → auto: "high" for Droid', () => {
      const result = transformOptionsForBackend(
        { ...base, autonomyLevel: AutonomyLevel.HIGH },
        BACKENDS.DROID
      );
      expect((result as any).auto).toBe('high');
      expect((result as any).autonomyLevel).toBeUndefined();
    });

    it('maps MEDIUM autonomyLevel → auto: "medium" for Droid', () => {
      const result = transformOptionsForBackend(
        { ...base, autonomyLevel: AutonomyLevel.MEDIUM },
        BACKENDS.DROID
      );
      expect((result as any).auto).toBe('medium');
    });

    it('maps READ_ONLY autonomyLevel → auto: "low" for Droid', () => {
      const result = transformOptionsForBackend(
        { ...base, autonomyLevel: AutonomyLevel.READ_ONLY },
        BACKENDS.DROID
      );
      expect((result as any).auto).toBe('low');
    });

    it('maps MEDIUM autonomyLevel → autoApprove: true for Cursor', () => {
      const result = transformOptionsForBackend(
        { ...base, backend: BACKENDS.CURSOR, autonomyLevel: AutonomyLevel.MEDIUM },
        BACKENDS.CURSOR
      );
      expect((result as any).autoApprove).toBe(true);
      // autonomyLevel is kept so backend executor can use it for safeguard checks
      expect((result as any).autonomyLevel).toBe(AutonomyLevel.MEDIUM);
    });

    it('maps READ_ONLY autonomyLevel → autoApprove: false for Cursor', () => {
      const result = transformOptionsForBackend(
        { ...base, backend: BACKENDS.CURSOR, autonomyLevel: AutonomyLevel.READ_ONLY },
        BACKENDS.CURSOR
      );
      expect((result as any).autoApprove).toBe(false);
    });

    it('strips autonomyLevel from Gemini options', () => {
      const result = transformOptionsForBackend(
        { ...base, backend: BACKENDS.GEMINI, autonomyLevel: AutonomyLevel.HIGH },
        BACKENDS.GEMINI
      );
      expect((result as any).autonomyLevel).toBeUndefined();
      expect((result as any).auto).toBeUndefined();
      expect((result as any).autoApprove).toBeUndefined();
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
