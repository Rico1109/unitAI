/**
 * Unit tests for Git Helper
 *
 * Note: These tests are environment-dependent and require a git repository.
 * They should be converted to fully isolated tests with mocked git commands (LOW priority).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockGitDiff, mockGitCommand, mockGitCommands, resetMockGitCommands } from '../utils/mockGit.js';

describe('GitHelper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    resetMockGitCommands();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unmock('../../src/utils/cli/commandExecutor.js');
  });

  describe('isGitRepository', () => {
    it('should return true when in git repository', async () => {
      const commandExecutor = await import('../../src/utils/cli/commandExecutor.js');
      const spy = vi.spyOn(commandExecutor, 'executeCommand').mockResolvedValue('.git');

      const { isGitRepository } = await import('../../src/utils/cli/gitHelper.js');
      const result = await isGitRepository();

      spy.mockRestore();
      expect(result).toBe(true);
    });

    it('should return false when not in git repository', async () => {
      const commandExecutor = await import('../../src/utils/cli/commandExecutor.js');
      const spy = vi.spyOn(commandExecutor, 'executeCommand').mockRejectedValue(new Error('Command failed with exit code 128'));

      const { isGitRepository } = await import('../../src/utils/cli/gitHelper.js');
      const result = await isGitRepository();

      spy.mockRestore();
      expect(result).toBe(false);
    });
  });

  describe('getGitRepoInfo', () => {
    it('should return complete repository information', async () => {
      const commandExecutor = await import('../../src/utils/cli/commandExecutor.js');
      const spy = vi.spyOn(commandExecutor, 'executeCommand').mockImplementation(async (cmd: string, args: string[] = []) => {
        const invoked = [cmd, ...args].join(' ').trim();

        if (invoked.includes('rev-parse --git-dir')) return '.git';
        if (invoked.includes('branch --show-current')) return 'main';
        if (invoked.includes('status --porcelain')) return '';
        if (invoked.includes('log --oneline -5')) return 'abc123 Commit message\ndef456 Another commit';
        if (invoked.includes('diff --cached --name-only')) return 'src/index.ts';
        if (invoked.includes('diff --name-only')) return 'README.md';

        return '';
      });

      const { getGitRepoInfo } = await import('../../src/utils/cli/gitHelper.js');
      const info = await getGitRepoInfo();

      spy.mockRestore();
      expect(info.currentBranch).toBe('main');
      expect(info.recentCommits).toHaveLength(2);
      expect(info.stagedFiles).toContain('src/index.ts');
      expect(info.modifiedFiles).toContain('README.md');
    });

    it('should throw error when not in git repository', async () => {
      const commandExecutor = await import('../../src/utils/cli/commandExecutor.js');
      const spy = vi.spyOn(commandExecutor, 'executeCommand').mockRejectedValue(new Error('Command failed with exit code 128'));

      const { getGitRepoInfo } = await import('../../src/utils/cli/gitHelper.js');
      await expect(getGitRepoInfo()).rejects.toThrow('not a Git repository');

      spy.mockRestore();
    });

    it('should handle empty staged and modified files', async () => {
      const commandExecutor = await import('../../src/utils/cli/commandExecutor.js');
      const spy = vi.spyOn(commandExecutor, 'executeCommand').mockImplementation(async (cmd: string, args: string[] = []) => {
        const invoked = [cmd, ...args].join(' ').trim();

        if (invoked.includes('rev-parse --git-dir')) return '.git';
        if (invoked.includes('branch --show-current')) return 'main';
        if (invoked.includes('status --porcelain')) return '';
        if (invoked.includes('log --oneline -5')) return 'abc123 Commit';
        if (invoked.includes('diff --cached --name-only')) return '';
        if (invoked.includes('diff --name-only')) return '';

        return '';
      });

      const { getGitRepoInfo } = await import('../../src/utils/cli/gitHelper.js');
      const info = await getGitRepoInfo();

      spy.mockRestore();
      expect(info.stagedFiles).toEqual([]);
      expect(info.modifiedFiles).toEqual([]);
    });
  });

  describe('getGitCommitInfo', () => {
    it('should return commit information for HEAD', async () => {
      const mockDiff = createMockGitDiff(
        'src/index.ts',
        ['+  console.log("hello");'],
        ['-  console.log("goodbye");']
      );

      const commandExecutor = await import('../../src/utils/cli/commandExecutor.js');
      const spy = vi.spyOn(commandExecutor, 'executeCommand').mockImplementation(async (cmd: string, args: string[] = []) => {
        const invoked = [cmd, ...args].join(' ').trim();

        if (invoked.includes('rev-parse --git-dir')) return '.git';
        if (invoked.includes('show --format=%H|%an|%ad|%s --date=iso HEAD')) {
          return 'abc123|John Doe|2024-01-15 10:30:00 +0000|Fix bug\n' + mockDiff;
        }
        if (invoked.includes('show --format= HEAD')) return mockDiff;
        if (invoked.includes('show --format= --name-only HEAD')) return 'src/index.ts';

        return '';
      });

      const { getGitCommitInfo } = await import('../../src/utils/cli/gitHelper.js');
      const info = await getGitCommitInfo('HEAD');

      spy.mockRestore();
      expect(info.hash).toBe('abc123');
      expect(info.author).toBe('John Doe');
      expect(info.message).toBe('Fix bug');
      expect(info.files).toContain('src/index.ts');
      expect(info.diff).toContain('+  console.log("hello");');
    });

    it('should throw error when not in git repository', async () => {
      const commandExecutor = await import('../../src/utils/cli/commandExecutor.js');
      const spy = vi.spyOn(commandExecutor, 'executeCommand').mockRejectedValue(new Error('Command failed with exit code 128'));

      const { getGitCommitInfo } = await import('../../src/utils/cli/gitHelper.js');
      await expect(getGitCommitInfo()).rejects.toThrow('not a Git repository');

      spy.mockRestore();
    });
  });

  describe('getRecentCommitsWithDiffs', () => {
    it('should return multiple commits with diffs', async () => {
      const mockDiff1 = createMockGitDiff('file1.ts', ['+line1'], ['-line0']);
      const mockDiff2 = createMockGitDiff('file2.ts', ['+line2'], ['-line1']);

      const commandExecutor = await import('../../src/utils/cli/commandExecutor.js');
      const spy = vi.spyOn(commandExecutor, 'executeCommand').mockImplementation(async (cmd: string, args: string[] = []) => {
        const invoked = [cmd, ...args].join(' ').trim();

        if (invoked.includes('rev-parse --git-dir')) return '.git';
        if (invoked.includes('log --oneline')) return 'abc123 Commit 1\ndef456 Commit 2';
        if (invoked.includes('show --format=%H|%an|%ad|%s --date=iso abc123')) {
          return 'abc123|Author1|2024-01-15 10:00:00 +0000|Commit 1\n' + mockDiff1;
        }
        if (invoked.includes('show --format= abc123')) return mockDiff1;
        if (invoked.includes('show --format= --name-only abc123')) return 'file1.ts';
        if (invoked.includes('show --format=%H|%an|%ad|%s --date=iso def456')) {
          return 'def456|Author2|2024-01-14 10:00:00 +0000|Commit 2\n' + mockDiff2;
        }
        if (invoked.includes('show --format= def456')) return mockDiff2;
        if (invoked.includes('show --format= --name-only def456')) return 'file2.ts';

        return '';
      });

      const { getRecentCommitsWithDiffs } = await import('../../src/utils/cli/gitHelper.js');
      const commits = await getRecentCommitsWithDiffs(2);

      spy.mockRestore();
      expect(commits).toHaveLength(2);
      expect(commits[0].hash).toBe('abc123');
      expect(commits[1].hash).toBe('def456');
    });
  });

  describe('getStagedDiff', () => {
    it('should return staged changes diff', async () => {
      const mockDiff = createMockGitDiff('src/test.ts', ['+new code'], ['-old code']);

      const commandExecutor = await import('../../src/utils/cli/commandExecutor.js');
      const spy = vi.spyOn(commandExecutor, 'executeCommand').mockImplementation(async (cmd: string, args: string[] = []) => {
        const invoked = [cmd, ...args].join(' ').trim();

        if (invoked.includes('rev-parse --git-dir')) return '.git';
        if (invoked.includes('diff --cached')) return mockDiff;

        return '';
      });

      const { getStagedDiff } = await import('../../src/utils/cli/gitHelper.js');
      const diff = await getStagedDiff();

      spy.mockRestore();
      expect(diff).toContain('+new code');
      expect(diff).toContain('-old code');
    });

    it('should return empty string when no staged changes', async () => {
      const commandExecutor = await import('../../src/utils/cli/commandExecutor.js');
      const spy = vi.spyOn(commandExecutor, 'executeCommand').mockImplementation(async (cmd: string, args: string[] = []) => {
        const invoked = [cmd, ...args].join(' ').trim();

        if (invoked.includes('rev-parse --git-dir')) return '.git';
        if (invoked.includes('diff --cached')) return '';

        return '';
      });

      const { getStagedDiff } = await import('../../src/utils/cli/gitHelper.js');
      const diff = await getStagedDiff();

      spy.mockRestore();
      expect(diff).toBe('');
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      const commandExecutor = await import('../../src/utils/cli/commandExecutor.js');
      const spy = vi.spyOn(commandExecutor, 'executeCommand').mockImplementation(async (cmd: string, args: string[] = []) => {
        const invoked = [cmd, ...args].join(' ').trim();

        if (invoked.includes('rev-parse --git-dir')) return '.git';
        if (invoked.includes('branch --show-current')) return 'feature/new-feature';

        return '';
      });

      const { getCurrentBranch } = await import('../../src/utils/cli/gitHelper.js');
      const branch = await getCurrentBranch();

      spy.mockRestore();
      expect(branch).toBe('feature/new-feature');
    });
  });

  describe('checkCLIAvailability', () => {
    it('should detect available CLI commands', async () => {
      const { checkCLIAvailability } = await import('../../src/utils/cli/gitHelper.js');
      const available = await checkCLIAvailability();

      // Function returns display-friendly keys (used for init-session display)
      expect(available).toHaveProperty('qwen');
      expect(available).toHaveProperty('gemini');
      expect(available).toHaveProperty('droid');
    });

    it('should detect unavailable CLI commands', async () => {
      const { checkCLIAvailability } = await import('../../src/utils/cli/gitHelper.js');
      const available = await checkCLIAvailability();

      // Function returns display-friendly keys (used for init-session display)
      expect(available).toHaveProperty('qwen');
      expect(available).toHaveProperty('gemini');
      expect(available).toHaveProperty('droid');
    });
  });
});
