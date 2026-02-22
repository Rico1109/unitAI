/**
 * Tests for bug-hunt workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bugHuntWorkflow } from '../../../src/workflows/bug-hunt.workflow.js';
import * as aiExecutor from '../../../src/services/ai-executor.js';
import * as auditTrail from '../../../src/services/audit-trail.js';
import * as fs from 'fs';

vi.mock('../../../src/services/ai-executor.js');
vi.mock('../../../src/services/audit-trail.js');
vi.mock('fs');

// Mock config to return consistent backend names regardless of config file state
vi.mock('../../../src/config/config.js', () => ({
  getRoleBackend: vi.fn().mockImplementation((role: string) => {
    const roles: Record<string, string> = {
      architect: 'ask-gemini',
      implementer: 'ask-qwen',
      tester: 'droid'
    };
    return roles[role] ?? 'ask-gemini';
  }),
  isBackendEnabled: vi.fn().mockReturnValue(true),
  loadConfig: vi.fn().mockReturnValue(null),
  getFallbackPriority: vi.fn().mockReturnValue(['ask-gemini', 'ask-qwen', 'droid']),
}));

// Mock model-selector to return predictable backends
vi.mock('../../../src/workflows/model-selector.js', () => ({
  selectParallelBackends: vi.fn().mockResolvedValue(['ask-gemini', 'ask-qwen', 'droid']),
  selectOptimalBackend: vi.fn().mockResolvedValue('ask-gemini'),
  createTaskCharacteristics: vi.fn().mockReturnValue({}),
}));

// Mock dependencies to avoid initialization errors
vi.mock('../../../src/dependencies.js', () => ({
  initializeDependencies: vi.fn(),
  closeDependencies: vi.fn(),
  getDependencies: vi.fn().mockReturnValue({
    activityDb: {}, auditDb: {}, tokenDb: {}, metricsDb: {},
    circuitBreaker: {
      get: vi.fn().mockReturnValue({
        isAvailable: vi.fn().mockReturnValue(true),
        onSuccess: vi.fn(),
        onFailure: vi.fn(),
      }),
      getAllStats: vi.fn().mockReturnValue({}),
      resetAll: vi.fn(),
    },
  }),
}));

describe('bug-hunt workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auditTrail.logAudit).mockResolvedValue(undefined);
  });

  it('should analyze provided files', async () => {
    const testFile = 'src/test.ts';
    const testContent = 'export function broken() { return null.toString(); }';

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(testContent);

    vi.mocked(aiExecutor.executeAIClient)
      .mockResolvedValueOnce('Root cause: null pointer dereference')
      .mockResolvedValueOnce('Hypothesis: missing null check')
      .mockResolvedValueOnce('Fix: Add null check before calling toString()');

    const result = await bugHuntWorkflow.execute({
      symptoms: 'Cannot read property toString of null',
      suspected_files: [testFile]
    });

    expect(result).toContain('Bug Hunt Report');
    expect(result).toContain('Root cause');
    expect(aiExecutor.executeAIClient).toHaveBeenCalled();
  });

  it('should discover files when not provided', async () => {
    vi.mocked(aiExecutor.executeAIClient)
      .mockResolvedValueOnce('src/auth.ts\nsrc/middleware.ts') // File discovery
      .mockResolvedValueOnce('Analysis results')
      .mockResolvedValueOnce('Fix recommendations');

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('code content');

    const result = await bugHuntWorkflow.execute({
      symptoms: 'Authentication fails randomly'
    });

    expect(result).toContain('Bug Hunt Report');
    expect(aiExecutor.executeAIClient).toHaveBeenCalled();
  });

  it('should handle case when no files found', async () => {
    vi.mocked(aiExecutor.executeAIClient)
      .mockResolvedValueOnce('No specific files mentioned');

    const result = await bugHuntWorkflow.execute({
      symptoms: 'Random error'
    });

    expect(result).toContain('Unable to identify relevant files');
  });

  it('should analyze related files when issues found', async () => {
    const testFile = 'src/buggy.ts';
    const testContent = `
import { helper } from './helper.js';
export function buggy() { helper(); }
`;

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(testContent);
    
    vi.mocked(aiExecutor.executeAIClient)
      .mockResolvedValueOnce('Found bug in this file')
      .mockResolvedValueOnce('Fix: update the code');

    const result = await bugHuntWorkflow.execute({
      symptoms: 'Function crashes',
      suspected_files: [testFile]
    });

    expect(result).toContain('Bug Hunt Report');
  });
});