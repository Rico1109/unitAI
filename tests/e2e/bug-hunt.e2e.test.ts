import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockAIExecutor } from '../utils/mockAI.js';

const createMockAsyncDb = () => ({
  execAsync: vi.fn().mockResolvedValue(undefined),
  runAsync: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 }),
  getAsync: vi.fn().mockResolvedValue(undefined),
  allAsync: vi.fn().mockResolvedValue([]),
  closeAsync: vi.fn().mockResolvedValue(undefined),
});

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
      executeWithBreaker: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    },
  })),
  initializeDependencies: vi.fn(),
  closeDependencies: vi.fn(),
}));

describe('E2E: bug-hunt workflow', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute using configured backends and return bug hunt report', async () => {
    // 1. Determine configured backends dynamically
    const { getRoleBackend } = await import('../../src/config/config.js');
    const architect = getRoleBackend('architect');
    const implementer = getRoleBackend('implementer');
    const tester = getRoleBackend('tester');

    // 2. Mock responses keyed by configured backends
    const mockResponses: Record<string, string> = {};
    mockResponses[architect] = `Architect analysis from ${architect}: Root cause identified in dependency injection chain. The bug stems from incorrect null handling.`;
    mockResponses[implementer] = `Implementer plan from ${implementer}: Remediation steps: 1. Fix null guard in factory. 2. Add unit tests. 3. Deploy patch.`;
    mockResponses[tester] = `Tester validation from ${tester}: Hypothesis: incorrect state initialization. Evidence: stack trace shows null dereference.`;

    // Fallbacks for all named backends
    if (!mockResponses['ask-gemini']) mockResponses['ask-gemini'] = 'Gemini: Root cause analysis complete. Bug found in initialization.';
    if (!mockResponses['ask-qwen']) mockResponses['ask-qwen'] = 'Qwen: Hypothesis generated. Null pointer in auth module.';
    if (!mockResponses['ask-droid']) mockResponses['ask-droid'] = 'Droid: Remediation plan ready. Apply patch and run tests.';
    if (!mockResponses['ask-cursor']) mockResponses['ask-cursor'] = 'Cursor: Code review complete. Issue in dependency chain.';
    if (!mockResponses['ask-rovodev']) mockResponses['ask-rovodev'] = 'Rovodev: Analysis complete. Fix identified.';

    mockAIExecutor(mockResponses);

    // 3. Import and run via executeTool
    // Pass suspected_files with a real file so the workflow skips the AI file-search step
    // and goes directly to analysis. package.json is guaranteed to exist.
    const { executeTool } = await import('../../src/tools/index.js');
    const result = await executeTool(
      'workflow_bug_hunt',
      {
        symptoms: 'Application crashes on startup with TypeError: Cannot read property of null',
        suspected_files: ['package.json'],
        autonomyLevel: 'read-only',
      },
      () => {},
      'test-req-id'
    );

    // 4. Assert
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    expect(text).toContain('Bug Hunt');
    expect(text).toContain('Root Cause Analysis');
    expect(text.length).toBeGreaterThan(50);
  });
});
