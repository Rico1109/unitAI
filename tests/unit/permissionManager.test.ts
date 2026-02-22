import { describe, it, expect } from 'vitest';
import {
  AutonomyLevel,
  OperationType,
  checkPermission,
  resolveAutonomyLevel,
  assertPermission,
  AUTO_LEVEL_MAP,
} from '../../src/utils/security/permissionManager.js';

describe('resolveAutonomyLevel', () => {
  it('returns the same level when not "auto"', () => {
    expect(resolveAutonomyLevel(AutonomyLevel.HIGH, 'any-workflow')).toBe(AutonomyLevel.HIGH);
    expect(resolveAutonomyLevel(AutonomyLevel.READ_ONLY, 'bug-hunt')).toBe(AutonomyLevel.READ_ONLY);
  });

  it('resolves "auto" for read-only workflows to READ_ONLY', () => {
    expect(resolveAutonomyLevel('auto', 'parallel-review')).toBe(AutonomyLevel.READ_ONLY);
    expect(resolveAutonomyLevel('auto', 'validate-last-commit')).toBe(AutonomyLevel.READ_ONLY);
    expect(resolveAutonomyLevel('auto', 'init-session')).toBe(AutonomyLevel.READ_ONLY);
    expect(resolveAutonomyLevel('auto', 'pre-commit-validate')).toBe(AutonomyLevel.READ_ONLY);
    expect(resolveAutonomyLevel('auto', 'triangulated-review')).toBe(AutonomyLevel.READ_ONLY);
  });

  it('resolves "auto" for overthinker to LOW', () => {
    expect(resolveAutonomyLevel('auto', 'overthinker')).toBe(AutonomyLevel.LOW);
  });

  it('resolves "auto" for write-capable workflows to MEDIUM', () => {
    expect(resolveAutonomyLevel('auto', 'bug-hunt')).toBe(AutonomyLevel.MEDIUM);
    expect(resolveAutonomyLevel('auto', 'feature-design')).toBe(AutonomyLevel.MEDIUM);
    expect(resolveAutonomyLevel('auto', 'auto-remediation')).toBe(AutonomyLevel.MEDIUM);
    expect(resolveAutonomyLevel('auto', 'refactor-sprint')).toBe(AutonomyLevel.MEDIUM);
  });

  it('falls back to MEDIUM for unknown workflow names', () => {
    expect(resolveAutonomyLevel('auto', 'unknown-workflow')).toBe(AutonomyLevel.MEDIUM);
  });
});

describe('assertPermission', () => {
  it('does not throw when operation is allowed at current level', () => {
    expect(() =>
      assertPermission(AutonomyLevel.LOW, OperationType.WRITE_FILE)
    ).not.toThrow();

    expect(() =>
      assertPermission(AutonomyLevel.MEDIUM, OperationType.GIT_COMMIT)
    ).not.toThrow();

    expect(() =>
      assertPermission(AutonomyLevel.HIGH, OperationType.GIT_PUSH)
    ).not.toThrow();

    expect(() =>
      assertPermission(AutonomyLevel.READ_ONLY, OperationType.READ_FILE)
    ).not.toThrow();
  });

  it('throws when operation exceeds current level', () => {
    expect(() =>
      assertPermission(AutonomyLevel.READ_ONLY, OperationType.WRITE_FILE)
    ).toThrow(/Permission denied/);

    expect(() =>
      assertPermission(AutonomyLevel.READ_ONLY, OperationType.GIT_COMMIT)
    ).toThrow(/Permission denied/);

    expect(() =>
      assertPermission(AutonomyLevel.LOW, OperationType.GIT_COMMIT)
    ).toThrow(/Permission denied/);

    expect(() =>
      assertPermission(AutonomyLevel.MEDIUM, OperationType.GIT_PUSH)
    ).toThrow(/Permission denied/);
  });

  it('includes context in the error message when provided', () => {
    expect(() =>
      assertPermission(AutonomyLevel.READ_ONLY, OperationType.WRITE_FILE, 'my-workflow')
    ).toThrow(/my-workflow/);
  });

  it('includes required level hint in the error message', () => {
    let errorMessage = '';
    try {
      assertPermission(AutonomyLevel.READ_ONLY, OperationType.WRITE_FILE);
    } catch (e) {
      errorMessage = (e as Error).message;
    }
    expect(errorMessage).toContain('low');
    expect(errorMessage).toContain('Grant');
  });
});

describe('AUTO_LEVEL_MAP', () => {
  it('has entries for all 10 workflows', () => {
    const expectedWorkflows = [
      'parallel-review', 'validate-last-commit', 'init-session',
      'pre-commit-validate', 'triangulated-review', 'overthinker',
      'bug-hunt', 'feature-design', 'auto-remediation', 'refactor-sprint',
    ];
    for (const workflow of expectedWorkflows) {
      expect(AUTO_LEVEL_MAP).toHaveProperty(workflow);
    }
  });
});

describe('checkPermission (existing behaviour, regression)', () => {
  it('READ_ONLY allows read operations', () => {
    expect(checkPermission(AutonomyLevel.READ_ONLY, OperationType.READ_FILE).allowed).toBe(true);
    expect(checkPermission(AutonomyLevel.READ_ONLY, OperationType.GIT_READ).allowed).toBe(true);
  });

  it('READ_ONLY denies write operations', () => {
    expect(checkPermission(AutonomyLevel.READ_ONLY, OperationType.WRITE_FILE).allowed).toBe(false);
    expect(checkPermission(AutonomyLevel.READ_ONLY, OperationType.GIT_COMMIT).allowed).toBe(false);
  });

  it('HIGH allows all operations', () => {
    for (const op of Object.values(OperationType)) {
      expect(checkPermission(AutonomyLevel.HIGH, op).allowed).toBe(true);
    }
  });
});
