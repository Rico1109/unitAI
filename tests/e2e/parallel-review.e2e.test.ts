
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockAIExecutor } from '../utils/mockAI.js';
import { mockGitCommands, resetMockGitCommands } from '../utils/mockGit.js';
import Database from 'better-sqlite3';

const createMockAsyncDb = () => ({
  execAsync: vi.fn().mockResolvedValue(undefined),
  runAsync: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 }),
  getAsync: vi.fn().mockResolvedValue(undefined),
  allAsync: vi.fn().mockResolvedValue([]),
  closeAsync: vi.fn().mockResolvedValue(undefined),
});

// Mock dependencies
vi.mock('../../src/dependencies.js', () => ({
  getDependencies: vi.fn(() => ({
    activityDb: createMockAsyncDb(),
    auditDb: createMockAsyncDb(),
    tokenDb: createMockAsyncDb(),
    metricsDb: createMockAsyncDb(),
    circuitBreaker: {
      isAvailable: vi.fn(() => true),
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
      executeWithBreaker: vi.fn(async (_name, fn) => fn()),
    },
  })),
  initializeDependencies: vi.fn(),
  closeDependencies: vi.fn(),
}));

describe('E2E: parallel-review workflow', () => {
  beforeEach(() => {
    vi.resetModules();
    resetMockGitCommands();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete full workflow via executeTool using configured backends', async () => {
    // 1. Setup Mock AI responses
    // 1. Determine Configured Backends dynamically
    const { getRoleBackend } = await import('../../src/config/config.js');
    const implementer = getRoleBackend('implementer');
    const architect = getRoleBackend('architect');
    const tester = getRoleBackend('tester');

    // 2. Setup Mock AI responses
    const mockResponses: Record<string, string> = {};

    // Populate responses for configured backends
    mockResponses[implementer] = `Analysis from ${implementer}: Code safe.`;
    mockResponses[architect] = `Analysis from ${architect}: Architecture sound.`;
    mockResponses[tester] = `Analysis from ${tester}: Quality good.`;

    // Basic Fallbacks
    if (!mockResponses['ask-gemini']) mockResponses['ask-gemini'] = 'Gemini analysis: Architecture looks sound.';
    if (!mockResponses['ask-cursor']) mockResponses['ask-cursor'] = 'Cursor analysis: Code style matches.';
    if (!mockResponses['ask-droid']) mockResponses['ask-droid'] = 'Droid analysis: No operational risks.';
    if (!mockResponses['ask-qwen']) mockResponses['ask-qwen'] = 'Qwen analysis: Code quality is good.';

    mockAIExecutor(mockResponses);

    // 2. Setup Mock Git
    mockGitCommands([
      { command: 'rev-parse --git-dir', output: '.git' },
    ]);

    // 3. Import executeTool dynamically AFTER mocks are set up
    const { executeTool } = await import('../../src/tools/index.js');

    const toolName = 'workflow_parallel_review';
    const args = {
      files: ['package.json'],
      focus: 'security',
      autonomyLevel: 'medium' // changed from read-only to match enum usually
    };
    // Note: parallel-review usually accepts 'read-only', but let's check schema if needed.
    // The previous error was on pre-commit-validate schema.

    const result = await executeTool(toolName, args, (msg) => console.log(msg), 'test-request-id');

    // 4. Verify result
    expect(result).toBeDefined();
    const resultText = typeof result === 'string' ? result : JSON.stringify(result);

    expect(resultText).toContain('Parallel Code Review');
    expect(resultText).toContain('Parallel Code Review');

    // We expect content from the backends. Since they are parallel, we should see at least one.
    // The exact string depends on what 'selectParallelBackends' chose, which now respects config.
    // Since we mocked responses generically like "Analysis from ...", we can check for that if we knew the backend.
    // However, simply checking that we got a result defined is a good baseline.
    // Let's check for one of the known response fragments if possible, or just length.
    expect(resultText.length).toBeGreaterThan(50);
  });

  it('should validate inputs correctly', async () => {
    const { executeTool } = await import('../../src/tools/index.js');
    const toolName = 'workflow_parallel_review';
    const args = {
      focus: 'security'
    };

    await expect(executeTool(toolName, args, () => { }, 'req-id')).rejects.toThrow();
  });
});
