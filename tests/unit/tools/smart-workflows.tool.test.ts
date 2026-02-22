/**
 * Tests for smart-workflows tool - autonomyLevel resolution
 *
 * Regression: smart-workflows.tool.ts calls executeWorkflow() directly,
 * bypassing the registry's resolveAutonomyLevel(). These tests verify
 * the fix: autonomyLevel is always resolved before reaching executeWorkflow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { smartWorkflowsTool } from '../../../src/tools/smart-workflows.tool.js';
import * as workflowsIndex from '../../../src/workflows/index.js';
import * as permissionManager from '../../../src/utils/security/permissionManager.js';
import { AutonomyLevel } from '../../../src/utils/security/permissionManager.js';

vi.mock('../../../src/workflows/index.js');
vi.mock('../../../src/utils/security/permissionManager.js');

describe('smart-workflows tool - autonomyLevel resolution', () => {
  const mockContext = { onProgress: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(workflowsIndex.executeWorkflow).mockResolvedValue('workflow result');
  });

  it('resolves explicit "auto" to workflow-specific level before calling executeWorkflow', async () => {
    vi.mocked(permissionManager.resolveAutonomyLevel).mockReturnValue(AutonomyLevel.MEDIUM);

    await smartWorkflowsTool.execute(
      { workflow: 'bug-hunt', params: { autonomyLevel: 'auto', symptoms: 'test bug' } },
      mockContext
    );

    expect(permissionManager.resolveAutonomyLevel).toHaveBeenCalledWith('auto', 'bug-hunt');
    expect(workflowsIndex.executeWorkflow).toHaveBeenCalledWith(
      'bug-hunt',
      expect.objectContaining({ autonomyLevel: AutonomyLevel.MEDIUM }),
      expect.anything()
    );
  });

  it('treats undefined autonomyLevel as "auto" and resolves it', async () => {
    vi.mocked(permissionManager.resolveAutonomyLevel).mockReturnValue(AutonomyLevel.MEDIUM);

    await smartWorkflowsTool.execute(
      { workflow: 'bug-hunt', params: { symptoms: 'test bug' } },
      mockContext
    );

    // The ?? 'auto' fallback must kick in
    expect(permissionManager.resolveAutonomyLevel).toHaveBeenCalledWith('auto', 'bug-hunt');
    expect(workflowsIndex.executeWorkflow).toHaveBeenCalledWith(
      'bug-hunt',
      expect.objectContaining({ autonomyLevel: AutonomyLevel.MEDIUM }),
      expect.anything()
    );
  });

  it('passes a concrete level through resolveAutonomyLevel unchanged', async () => {
    vi.mocked(permissionManager.resolveAutonomyLevel).mockReturnValue(AutonomyLevel.HIGH);

    await smartWorkflowsTool.execute(
      { workflow: 'bug-hunt', params: { autonomyLevel: 'high', symptoms: 'test bug' } },
      mockContext
    );

    expect(permissionManager.resolveAutonomyLevel).toHaveBeenCalledWith('high', 'bug-hunt');
    expect(workflowsIndex.executeWorkflow).toHaveBeenCalledWith(
      'bug-hunt',
      expect.objectContaining({ autonomyLevel: AutonomyLevel.HIGH }),
      expect.anything()
    );
  });

  it('resolves "auto" to READ_ONLY for read-only workflows (parallel-review)', async () => {
    vi.mocked(permissionManager.resolveAutonomyLevel).mockReturnValue(AutonomyLevel.READ_ONLY);

    await smartWorkflowsTool.execute(
      { workflow: 'parallel-review', params: { autonomyLevel: 'auto', files: ['src/foo.ts'] } },
      mockContext
    );

    expect(permissionManager.resolveAutonomyLevel).toHaveBeenCalledWith('auto', 'parallel-review');
    expect(workflowsIndex.executeWorkflow).toHaveBeenCalledWith(
      'parallel-review',
      expect.objectContaining({ autonomyLevel: AutonomyLevel.READ_ONLY }),
      expect.anything()
    );
  });
});
