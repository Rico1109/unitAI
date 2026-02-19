/**
 * Tests for pre-commit-validate workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { preCommitValidateWorkflow } from '../../../src/workflows/pre-commit-validate.workflow.js';
import * as gitHelper from '../../../src/utils/cli/gitHelper.js';
import * as aiExecutor from '../../../src/services/ai-executor.js';
import * as auditTrail from '../../../src/services/audit-trail.js';

vi.mock('../../../src/utils/cli/gitHelper.js');
vi.mock('../../../src/services/ai-executor.js');
vi.mock('../../../src/services/audit-trail.js');

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

describe('pre-commit-validate workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auditTrail.logAudit).mockResolvedValue(undefined);
  });

  it('should return message when no staged files', async () => {
    vi.mocked(gitHelper.getStagedDiff).mockResolvedValue('');

    const result = await preCommitValidateWorkflow.execute({
      depth: 'thorough'
    });

    expect(result).toContain('No staged files');
  });

  it('should run parallel checks on staged files', async () => {
    const mockDiff = `
diff --git a/src/test.ts b/src/test.ts
+++ b/src/test.ts
@@ -1,3 +1,4 @@
+const apiKey = "sk-1234567890";
 export function test() {
   console.log("test");
 }
`;

    vi.mocked(gitHelper.getStagedDiff).mockResolvedValue(mockDiff);
    
    // Mock AI responses
    vi.mocked(aiExecutor.executeAIClient)
      .mockResolvedValueOnce('{"hasSecrets": true, "findings": [{"type": "API Key", "severity": "CRITICAL", "line": "2", "recommendation": "Remove hardcoded key"}]}')
      .mockResolvedValueOnce('{"qualityScore": 75, "issues": [], "positives": ["Clean code"]}')
      .mockResolvedValueOnce('{"hasBreakingChanges": false, "changes": []}');

    const result = await preCommitValidateWorkflow.execute({
      depth: 'thorough'
    });

    expect(result).toContain('Pre-Commit Validation Report');
    expect(aiExecutor.executeAIClient).toHaveBeenCalledTimes(3);
    expect(result).toContain('FAIL'); // Should fail due to secrets
  });

  it('should handle different depth levels', async () => {
    vi.mocked(gitHelper.getStagedDiff).mockResolvedValue('some diff');
    vi.mocked(aiExecutor.executeAIClient)
      .mockResolvedValue('{"hasSecrets": false, "findings": []}');

    await preCommitValidateWorkflow.execute({ depth: 'quick' });
    
    expect(aiExecutor.executeAIClient).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('fast and flag only obvious issues')
      })
    );
  });

  it('should pass validation when all checks pass', async () => {
    vi.mocked(gitHelper.getStagedDiff).mockResolvedValue('clean diff');
    
    vi.mocked(aiExecutor.executeAIClient)
      .mockResolvedValueOnce('{"hasSecrets": false, "findings": []}')
      .mockResolvedValueOnce('{"qualityScore": 90, "issues": [], "positives": ["Excellent"]}')
      .mockResolvedValueOnce('{"hasBreakingChanges": false, "changes": []}');

    const result = await preCommitValidateWorkflow.execute({
      depth: 'thorough'
    });

    expect(result).toContain('PASS');
  });
});