
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

describe('E2E: init-session workflow', () => {
  beforeEach(() => {
    vi.resetModules();
    resetMockGitCommands();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize session with context using configured backend', async () => {
    // 1. Setup Mock Git and CLI commands
    mockGitCommands([
      { command: 'rev-parse --git-dir', output: '.git' },
      { command: 'log --oneline -n 5', output: 'a1b2c3d Feat: Add new API\ne5f6g7h Fix: Bug in login' },
      { command: 'status --porcelain', output: ' M src/api.ts' },
      // Mock CLI availability checks
      { command: 'gemini --version', output: '1.0.0' },
      { command: 'qwen --version', output: '1.0.0' },
      { command: 'droid --version', output: '1.0.0' },
    ]);

    // 2. Setup Mock AI
    // 2. Determine Configured Backends dynamically
    const { getRoleBackend } = await import('../../src/config/config.js');
    const architect = getRoleBackend('architect');

    const mockResponses: Record<string, string> = {
      'rovodev': 'Session Analysis: You are working on the API feature.',
    };

    mockResponses[architect] = 'Deep analysis: Context is clear.';

    // Fallbacks
    if (!mockResponses['ask-qwen']) mockResponses['ask-qwen'] = 'Quick analysis: Context looks good.';
    if (!mockResponses['ask-gemini']) mockResponses['ask-gemini'] = 'Deep analysis: Context is clear.';

    mockAIExecutor(mockResponses);

    // 3. Import executeTool dynamically
    const { executeTool } = await import('../../src/tools/index.js');

    const toolName = 'workflow_init_session';
    const args = {
      commitCount: 5,
      autonomyLevel: 'read-only'
    };

    const result = await executeTool(toolName, args, () => { }, 'test-req-id');

    // 4. Verify result
    const resultText = typeof result === 'string' ? result : JSON.stringify(result);
    expect(resultText).toContain('Session Initialization');
    // Expect the response that was actually chosen by the workflow
    expect(resultText).toContain('Deep analysis: Context is clear.');
  });
});
