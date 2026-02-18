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

describe('E2E: auto-remediation workflow', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute using configured backend and return auto remediation plan', async () => {
    // 1. Determine configured backends dynamically
    // The auto-remediation workflow uses selectOptimalBackend with requiresCodeGeneration=true
    // and domain='general', which resolves to getRoleBackend('implementer').
    const { getRoleBackend } = await import('../../src/config/config.js');
    const architect = getRoleBackend('architect');
    const implementer = getRoleBackend('implementer');
    const tester = getRoleBackend('tester');

    // 2. Mock responses keyed by configured backends
    // selectOptimalBackend with requiresCodeGeneration=true -> role='implementer'
    const mockResponses: Record<string, string> = {};
    mockResponses[implementer] = `Implementer remediation from ${implementer}: Autonomous Remediation Plan: Step 1 - Restart affected services. Step 2 - Clear stale cache. Step 3 - Verify database connections. Step 4 - Monitor logs for recurrence. Step 5 - Apply hotfix patch.`;
    mockResponses[architect] = `Architect analysis from ${architect}: Symptoms reviewed. Auto Remediation Plan outlined. Root cause in infrastructure layer.`;
    mockResponses[tester] = `Tester validation from ${tester}: Remediation steps validated. Symptoms addressed. All checks pass.`;

    // Fallbacks for all named backends
    if (!mockResponses['ask-gemini']) mockResponses['ask-gemini'] = 'Gemini: Auto Remediation Plan ready. Symptoms analyzed.';
    if (!mockResponses['ask-qwen']) mockResponses['ask-qwen'] = 'Qwen: Autonomous Remediation Plan complete. Steps validated.';
    if (!mockResponses['ask-droid']) mockResponses['ask-droid'] = 'Droid: Remediation steps generated. Symptoms: identified and resolved.';
    if (!mockResponses['ask-cursor']) mockResponses['ask-cursor'] = 'Cursor: Auto Remediation Plan approved. Implementation ready.';
    if (!mockResponses['ask-rovodev']) mockResponses['ask-rovodev'] = 'Rovodev: Autonomous Remediation Plan executed. Symptoms cleared.';

    mockAIExecutor(mockResponses);

    // 3. Import and run via executeTool
    const { executeTool } = await import('../../src/tools/index.js');
    const result = await executeTool(
      'workflow_auto_remediation',
      {
        symptoms: 'Service memory usage spikes to 2GB then crashes with OOM error every 6 hours',
        maxActions: 5,
        autonomyLevel: 'read-only',
      },
      () => {},
      'test-req-id'
    );

    // 4. Assert
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    // The workflow title is "Auto Remediation Plan" via formatWorkflowOutput
    expect(text).toContain('Auto Remediation Plan');
    // The content section header
    expect(text).toContain('Symptoms');
    // The remediation plan section
    const hasRemediationSection =
      text.includes('Autonomous Remediation Plan') ||
      text.includes('Remediation Plan') ||
      text.includes('remediation');
    expect(hasRemediationSection).toBe(true);
    expect(text.length).toBeGreaterThan(50);
  });
});
