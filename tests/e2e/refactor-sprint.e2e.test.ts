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

describe('E2E: refactor-sprint workflow', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute using configured backends and return refactor sprint report', async () => {
    // 1. Determine configured backends dynamically
    // The refactor-sprint workflow uses selectParallelBackends which picks from the
    // configured/enabled backends. We mock all possible backends so any selection works.
    const { getRoleBackend } = await import('../../src/config/config.js');
    const architect = getRoleBackend('architect');
    const implementer = getRoleBackend('implementer');
    const tester = getRoleBackend('tester');

    // 2. Mock responses keyed by configured backends
    // Step 1: implementer generates the refactoring plan
    // Step 2: architect does the architecture review
    // Step 3: tester creates the operational checklist
    const mockResponses: Record<string, string> = {};
    mockResponses[implementer] = `Implementer plan from ${implementer}: Refactoring Plan: 1. Extract service layer. 2. Apply repository pattern. 3. Add dependency injection. Suggested patches included.`;
    mockResponses[architect] = `Architect review from ${architect}: Architecture Review complete. Risks identified: coupling in legacy modules. Recommendations: use interfaces for abstraction.`;
    mockResponses[tester] = `Tester checklist from ${tester}: Operational Checklist ready. Steps: run tests, apply patches, validate CI pipeline, deploy to staging.`;

    // Fallbacks for all named backends
    if (!mockResponses['ask-gemini']) mockResponses['ask-gemini'] = 'Gemini: Architecture Review complete. Refactoring Plan evaluated.';
    if (!mockResponses['ask-qwen']) mockResponses['ask-qwen'] = 'Qwen: Operational Checklist generated. Refactoring Plan validated.';
    if (!mockResponses['ask-droid']) mockResponses['ask-droid'] = 'Droid: Refactoring Plan created. Implementation steps ready.';
    if (!mockResponses['ask-cursor']) mockResponses['ask-cursor'] = 'Cursor: Architecture Review complete. Code structure improved.';
    if (!mockResponses['ask-rovodev']) mockResponses['ask-rovodev'] = 'Rovodev: Operational Checklist ready. Execution plan defined.';

    mockAIExecutor(mockResponses);

    // 3. Import and run via executeTool
    const { executeTool } = await import('../../src/tools/index.js');
    const result = await executeTool(
      'workflow_refactor_sprint',
      {
        scope: 'Migrate legacy service layer to clean architecture with dependency injection',
        targetFiles: ['src/services/user.service.ts', 'src/controllers/user.controller.ts'],
        autonomyLevel: 'read-only',
      },
      () => {},
      'test-req-id'
    );

    // 4. Assert
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    expect(text).toContain('Refactor Sprint');
    // The workflow output will contain at least one of the section headers
    const hasExpectedSection =
      text.includes('Refactoring Plan') ||
      text.includes('Architecture Review') ||
      text.includes('Operational Checklist') ||
      text.includes('Implementer Plan') ||
      text.includes('Architect Review') ||
      text.includes('Tester Checklist');
    expect(hasExpectedSection).toBe(true);
    expect(text.length).toBeGreaterThan(50);
  });
});
