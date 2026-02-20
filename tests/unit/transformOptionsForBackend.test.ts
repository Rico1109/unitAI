import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks
const mocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  validateFilePaths: vi.fn((paths: string[]) => paths.map(p => `/validated/${p}`)),
  getBackend: vi.fn(),
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: mocks.logger
}));

// Mock pathValidator
vi.mock('../../src/utils/security/pathValidator.js', () => ({
  validateFilePaths: mocks.validateFilePaths,
  validateFilePath: vi.fn()
}));

// Mock BackendRegistry
vi.mock('../../src/backends/backend-registry.js', () => ({
  BackendRegistry: {
    getInstance: () => ({
      getBackend: mocks.getBackend
    })
  }
}));

// Import subject under test
import { transformOptionsForBackend, AIExecutionOptions } from '../../src/services/ai-executor.js';

describe('transformOptionsForBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cli-flag to embed-in-prompt transformation', () => {
    it('should embed attachments in prompt when target backend uses embed-in-prompt mode', () => {
      // Setup: target backend (like Droid) uses embed-in-prompt
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: true,
          supportsStreaming: false,
          supportsSandbox: false,
          supportsJSON: true,
          fileMode: 'embed-in-prompt'
        })
      });

      const options: AIExecutionOptions = {
        backend: 'cursor',
        prompt: 'Analyze this code',
        attachments: ['file1.ts', 'file2.ts']
      };

      const result = transformOptionsForBackend(options, 'droid');

      expect(result.backend).toBe('droid');
      expect(result.prompt).toContain('[Files to analyze:');
      expect(result.prompt).toContain('/validated/file1.ts');
      expect(result.prompt).toContain('/validated/file2.ts');
      expect(result.prompt).toContain('Analyze this code');
      expect(result.attachments).toEqual([]);
      expect(mocks.validateFilePaths).toHaveBeenCalledWith(['file1.ts', 'file2.ts']);
    });

    it('should log debug message when transforming to embed-in-prompt', () => {
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: true,
          fileMode: 'embed-in-prompt'
        })
      });

      const options: AIExecutionOptions = {
        backend: 'cursor',
        prompt: 'Test',
        attachments: ['file.ts']
      };

      transformOptionsForBackend(options, 'droid');

      expect(mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Transformed attachments to embedded prompt')
      );
    });
  });

  describe('cli-flag to none transformation', () => {
    it('should embed attachments when target backend has fileMode none', () => {
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: false,
          fileMode: 'none'
        })
      });

      const options: AIExecutionOptions = {
        backend: 'cursor',
        prompt: 'Review code',
        attachments: ['src/main.ts']
      };

      const result = transformOptionsForBackend(options, 'some-backend');

      expect(result.backend).toBe('some-backend');
      expect(result.prompt).toContain('[Files to analyze:');
      expect(result.prompt).toContain('/validated/src/main.ts');
      expect(result.attachments).toEqual([]);
      expect(mocks.validateFilePaths).toHaveBeenCalledWith(['src/main.ts']);
    });

    it('should log warning when backend does not support files', () => {
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: false,
          fileMode: 'none'
        })
      });

      const options: AIExecutionOptions = {
        backend: 'cursor',
        prompt: 'Test',
        attachments: ['file.ts']
      };

      transformOptionsForBackend(options, 'no-files-backend');

      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("doesn't support files, embedding in prompt as fallback")
      );
    });
  });

  describe('cli-flag to cli-flag (no transformation needed)', () => {
    it('should pass attachments as-is when target backend uses cli-flag mode', () => {
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: true,
          fileMode: 'cli-flag'
        })
      });

      const options: AIExecutionOptions = {
        backend: 'gemini',
        prompt: 'Analyze code',
        attachments: ['file.ts']
      };

      const result = transformOptionsForBackend(options, 'cursor');

      expect(result.backend).toBe('cursor');
      expect(result.prompt).toBe('Analyze code');
      expect(result.attachments).toEqual(['file.ts']);
      // No validation called because attachments are passed through
      expect(mocks.validateFilePaths).not.toHaveBeenCalled();
    });
  });

  describe('empty attachments (no transformation needed)', () => {
    it('should not transform when attachments array is empty', () => {
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: true,
          fileMode: 'embed-in-prompt'
        })
      });

      const options: AIExecutionOptions = {
        backend: 'cursor',
        prompt: 'Simple prompt',
        attachments: []
      };

      const result = transformOptionsForBackend(options, 'droid');

      expect(result.backend).toBe('droid');
      expect(result.prompt).toBe('Simple prompt');
      expect(result.attachments).toEqual([]);
      expect(mocks.validateFilePaths).not.toHaveBeenCalled();
    });

    it('should not transform when attachments is undefined', () => {
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: true,
          fileMode: 'embed-in-prompt'
        })
      });

      const options: AIExecutionOptions = {
        backend: 'cursor',
        prompt: 'No attachments'
      };

      const result = transformOptionsForBackend(options, 'droid');

      expect(result.backend).toBe('droid');
      expect(result.prompt).toBe('No attachments');
      expect(mocks.validateFilePaths).not.toHaveBeenCalled();
    });
  });

  describe('unknown backend handling', () => {
    it('should return options with updated backend when executor not found', () => {
      mocks.getBackend.mockReturnValue(undefined);

      const options: AIExecutionOptions = {
        backend: 'cursor',
        prompt: 'Test prompt',
        attachments: ['file.ts']
      };

      const result = transformOptionsForBackend(options, 'unknown-backend');

      expect(result.backend).toBe('unknown-backend');
      expect(result.prompt).toBe('Test prompt');
      expect(result.attachments).toEqual(['file.ts']);
      expect(mocks.validateFilePaths).not.toHaveBeenCalled();
    });
  });

  describe('path validation security', () => {
    it('should validate paths before embedding in embed-in-prompt mode', () => {
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: true,
          fileMode: 'embed-in-prompt'
        })
      });

      const options: AIExecutionOptions = {
        backend: 'cursor',
        prompt: 'Analyze',
        attachments: ['../malicious.ts', 'normal.ts']
      };

      transformOptionsForBackend(options, 'droid');

      expect(mocks.validateFilePaths).toHaveBeenCalledWith(['../malicious.ts', 'normal.ts']);
    });

    it('should validate paths before embedding in none mode', () => {
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: false,
          fileMode: 'none'
        })
      });

      const options: AIExecutionOptions = {
        backend: 'cursor',
        prompt: 'Analyze',
        attachments: ['../../etc/passwd']
      };

      transformOptionsForBackend(options, 'no-file-backend');

      expect(mocks.validateFilePaths).toHaveBeenCalledWith(['../../etc/passwd']);
    });

    it('should throw when path validation fails', () => {
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: true,
          fileMode: 'embed-in-prompt'
        })
      });
      mocks.validateFilePaths.mockImplementation(() => {
        throw new Error('Path traversal detected: ../malicious.ts');
      });

      const options: AIExecutionOptions = {
        backend: 'cursor',
        prompt: 'Analyze',
        attachments: ['../malicious.ts']
      };

      expect(() => transformOptionsForBackend(options, 'droid')).toThrow('Path traversal detected');
    });
  });

  describe('idempotency - already transformed options', () => {
    it('should not double-embed when attachments already cleared', () => {
      // Simulate options that were already transformed (attachments cleared)
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: true,
          fileMode: 'embed-in-prompt'
        })
      });

      const alreadyTransformedOptions: AIExecutionOptions = {
        backend: 'droid',
        prompt: '[Files to analyze: /abs/file.ts]\n\nOriginal prompt',
        attachments: [] // Already cleared from previous transformation
      };

      const result = transformOptionsForBackend(alreadyTransformedOptions, 'qwen');

      // Should not add another [Files to analyze:] prefix
      expect(result.prompt).toBe('[Files to analyze: /abs/file.ts]\n\nOriginal prompt');
      expect(result.attachments).toEqual([]);
      expect(mocks.validateFilePaths).not.toHaveBeenCalled();
    });
  });

  describe('option preservation', () => {
    it('should preserve other options during transformation', () => {
      mocks.getBackend.mockReturnValue({
        getCapabilities: () => ({
          supportsFiles: true,
          fileMode: 'embed-in-prompt'
        })
      });

      const options: AIExecutionOptions = {
        backend: 'cursor',
        prompt: 'Analyze',
        attachments: ['file.ts'],
        outputFormat: 'json',
        sandbox: true,
        autoApprove: true,
        requestId: 'req-123'
      };

      const result = transformOptionsForBackend(options, 'droid');

      expect(result.outputFormat).toBe('json');
      expect(result.sandbox).toBe(true);
      // Droid uses 'auto' field, autoApprove should be removed and converted to auto
      expect(result.auto).toBe('high'); // autoApprove: true converts to auto: "high"
      expect(result.autoApprove).toBeUndefined(); // autoApprove removed for Droid
      expect(result.requestId).toBe('req-123');
    });
  });
});
