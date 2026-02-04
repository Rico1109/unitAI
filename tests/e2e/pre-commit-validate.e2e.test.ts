
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockAIExecutor } from '../utils/mockAI.js';
import { createMockGitDiff, mockGitHelper, resetMockGitCommands } from '../utils/mockGit.js';
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

describe('E2E: pre-commit-validate workflow', () => {
  beforeEach(() => {
    vi.resetModules();
    resetMockGitCommands();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should validate staged changes using configured backends', async () => {
    // 1. Setup Mock Git via helper to ensure getStagedDiff returns content
    const mockDiff = createMockGitDiff('src/new-feature.ts', ['+console.log("debug")'], []);

    mockGitHelper({
      getStagedDiff: mockDiff,
      isGitRepository: true
    });

    // 2. Determine Configured Backends dynamically
    // This allows the test to pass regardless of which backends the user has selected in the wizard.
    const { getRoleBackend } = await import('../../src/config/config.js');
    const testerBackend = getRoleBackend('tester'); // Security checks
    const architectureBackend = getRoleBackend('architect'); // Impact analysis
    const implementerBackend = getRoleBackend('implementer'); // Code review

    // 3. Setup Mock AI with responses mapped to the CONFIGURED backends
    const mockResponses: Record<string, string> = {};

    // Security check (Tester role) expects JSON
    mockResponses[testerBackend] = '{"hasSecrets": false, "findings": []}';

    // Impact analysis (Architect role) expects JSON
    mockResponses[architectureBackend] = '{"qualityScore": 80, "issues": [], "positives": ["Good"]}';

    // Code review (Implementer role) implementation plan
    mockResponses[implementerBackend] = 'Plan: Remediation not needed.';

    // Add fallbacks for specific named backends just in case of overlaps or hardcoded fallbacks
    // Configured backends take precedence, but if testerBackend IS 'ask-qwen', this line is redundant but safe.
    if (!mockResponses['ask-qwen']) mockResponses['ask-qwen'] = '{"qualityScore": 80, "issues": [], "positives": ["Good"]}';
    if (!mockResponses['ask-gemini']) mockResponses['ask-gemini'] = '{"hasSecrets": false, "findings": []}';
    if (!mockResponses['ask-droid']) mockResponses['ask-droid'] = 'Plan: Remediation not needed.';

    mockAIExecutor(mockResponses);

    // 4. Import executeTool dynamically
    const { executeTool } = await import('../../src/tools/index.js');

    const toolName = 'workflow_pre_commit_validate';
    const args = {
      depth: 'thorough',
      autonomyLevel: 'MEDIUM'
    };

    const result = await executeTool(toolName, args, () => { }, 'test-req-id');

    // 5. Verify result
    const resultText = typeof result === 'string' ? result : JSON.stringify(result);
    expect(resultText).toContain('Pre-Commit Validation');
    expect(resultText).toContain('No secrets detected');
  });
});
