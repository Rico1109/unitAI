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

describe('E2E: feature-design workflow', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute using configured backends and return feature design output', async () => {
    // 1. Determine configured backends dynamically
    const { getRoleBackend } = await import('../../src/config/config.js');
    const architect = getRoleBackend('architect');
    const implementer = getRoleBackend('implementer');
    const tester = getRoleBackend('tester');

    // 2. Mock responses keyed by configured backends
    // The feature-design workflow uses agents that internally call executeAIClient.
    // Each agent delegates to a backend resolved via selectOptimalBackend / getRoleBackend.
    const mockResponses: Record<string, string> = {};
    mockResponses[architect] = `Architect analysis from ${architect}: Feature Design ready. Architecture pattern: layered service with repository. Implementation Plan: 1. Define interfaces 2. Implement service 3. Wire DI.`;
    mockResponses[implementer] = `Implementer plan from ${implementer}: Implementation Plan complete. Code generated for target files. All edge cases handled.`;
    mockResponses[tester] = `Tester validation from ${tester}: Test suite generated. Unit tests cover 85% of new code. Integration tests defined.`;

    // Fallbacks for all named backends
    if (!mockResponses['ask-gemini']) mockResponses['ask-gemini'] = 'Gemini: Architectural design complete. Feature Design outlined.';
    if (!mockResponses['ask-qwen']) mockResponses['ask-qwen'] = 'Qwen: Test generation complete. Implementation Plan verified.';
    if (!mockResponses['ask-droid']) mockResponses['ask-droid'] = 'Droid: Implementation Plan ready. Code scaffolded.';
    if (!mockResponses['ask-cursor']) mockResponses['ask-cursor'] = 'Cursor: Review complete. Feature Design approved.';
    if (!mockResponses['ask-rovodev']) mockResponses['ask-rovodev'] = 'Rovodev: Execution complete. Feature Design deployed.';

    mockAIExecutor(mockResponses);

    // 3. Import and run via executeTool
    const { executeTool } = await import('../../src/tools/index.js');
    const result = await executeTool(
      'workflow_feature_design',
      {
        featureDescription: 'Add user authentication with JWT tokens and refresh token rotation',
        targetFiles: ['src/auth/auth.service.ts', 'src/auth/auth.controller.ts'],
        autonomyLevel: 'read-only',
      },
      () => {},
      'test-req-id'
    );

    // 4. Assert
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    expect(text).toContain('Feature Design');
    expect(text).toContain('Implementation Plan');
    expect(text.length).toBeGreaterThan(50);
  });
});
