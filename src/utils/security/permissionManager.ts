/**
 * Permission Manager for Unified AI MCP Tool
 *
 * Implements a granular permission system inspired by Factory Droid's autonomy levels.
 * Allows workflows to execute operations safely based on configured autonomy levels.
 *
 * @module permissionManager
 */


/**
 * Permission levels for autonomous operations
 *
 * - READ_ONLY: Only read operations (git status, git diff, file reads)
 * - LOW: File modifications within project
 * - MEDIUM: Local Git operations (commit, branch) and dependency management
 * - HIGH: External operations (git push, external APIs)
 */
export enum AutonomyLevel {
  READ_ONLY = "read-only",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high"
}

/**
 * Operation categories requiring permission checks
 */
export enum OperationType {
  READ_FILE = "read_file",
  WRITE_FILE = "write_file",
  GIT_READ = "git_read",
  GIT_COMMIT = "git_commit",
  GIT_PUSH = "git_push",
  GIT_BRANCH = "git_branch",
  INSTALL_DEPENDENCY = "install_dependency",
  EXECUTE_COMMAND = "execute_command",
  EXTERNAL_API = "external_api",
  MCP_CALL = "mcp_call"
}

/**
 * Permission matrix mapping operations to required autonomy levels
 */
const PERMISSION_MATRIX: Record<OperationType, AutonomyLevel> = {
  [OperationType.READ_FILE]: AutonomyLevel.READ_ONLY,
  [OperationType.GIT_READ]: AutonomyLevel.READ_ONLY,
  [OperationType.MCP_CALL]: AutonomyLevel.READ_ONLY, // MCP calls default to read-only
  [OperationType.WRITE_FILE]: AutonomyLevel.LOW,
  [OperationType.EXECUTE_COMMAND]: AutonomyLevel.MEDIUM,
  [OperationType.GIT_COMMIT]: AutonomyLevel.MEDIUM,
  [OperationType.GIT_BRANCH]: AutonomyLevel.MEDIUM,
  [OperationType.INSTALL_DEPENDENCY]: AutonomyLevel.MEDIUM,
  [OperationType.GIT_PUSH]: AutonomyLevel.HIGH,
  [OperationType.EXTERNAL_API]: AutonomyLevel.HIGH
};

/**
 * Permission validation result
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiredLevel?: AutonomyLevel;
  currentLevel?: AutonomyLevel;
}

/**
 * Hierarchy of autonomy levels (ordered from least to most permissive)
 */
const LEVEL_HIERARCHY: AutonomyLevel[] = [
  AutonomyLevel.READ_ONLY,
  AutonomyLevel.LOW,
  AutonomyLevel.MEDIUM,
  AutonomyLevel.HIGH
];

/**
 * Validates if an operation is allowed at the given autonomy level
 *
 * @param currentLevel - Current autonomy level
 * @param operation - Operation type to validate
 * @returns Permission result with allowed status and reason if denied
 *
 * @example
 * ```typescript
 * const result = checkPermission(AutonomyLevel.LOW, OperationType.GIT_PUSH);
 * if (!result.allowed) {
 *   console.error(result.reason);
 * }
 * ```
 */
export function checkPermission(
  currentLevel: AutonomyLevel,
  operation: OperationType
): PermissionResult {
  const requiredLevel = PERMISSION_MATRIX[operation];

  const currentIndex = LEVEL_HIERARCHY.indexOf(currentLevel);
  const requiredIndex = LEVEL_HIERARCHY.indexOf(requiredLevel);

  if (currentIndex >= requiredIndex) {
    return {
      allowed: true,
      currentLevel,
      requiredLevel
    };
  }

  return {
    allowed: false,
    reason: `Operation '${operation}' requires '${requiredLevel}' level but current level is '${currentLevel}'`,
    requiredLevel,
    currentLevel
  };
}


/**
 * Gets the default autonomy level for workflows
 *
 * @returns Default autonomy level (READ_ONLY)
 */
export function getDefaultAutonomyLevel(): AutonomyLevel {
  return AutonomyLevel.READ_ONLY;
}

/**
 * Validates if a string is a valid AutonomyLevel
 *
 * @param level - String to validate
 * @returns True if valid autonomy level
 */
export function isValidAutonomyLevel(level: string): level is AutonomyLevel {
  return Object.values(AutonomyLevel).includes(level as AutonomyLevel);
}

/**
 * Gets all operations allowed at a given autonomy level
 *
 * @param level - Autonomy level to query
 * @returns Array of allowed operation types
 */
export function getAllowedOperations(level: AutonomyLevel): OperationType[] {
  return Object.entries(PERMISSION_MATRIX)
    .filter(([_, requiredLevel]) => {
      const currentIndex = LEVEL_HIERARCHY.indexOf(level);
      const requiredIndex = LEVEL_HIERARCHY.indexOf(requiredLevel);
      return currentIndex >= requiredIndex;
    })
    .map(([operation, _]) => operation as OperationType);
}


/**
 * Maps workflow names to their minimum required autonomy level.
 * Used when autonomyLevel is "auto" to resolve to the correct concrete level.
 */
export const AUTO_LEVEL_MAP: Record<string, AutonomyLevel> = {
  'parallel-review':      AutonomyLevel.READ_ONLY,
  'validate-last-commit': AutonomyLevel.READ_ONLY,
  'init-session':         AutonomyLevel.READ_ONLY,
  'pre-commit-validate':  AutonomyLevel.READ_ONLY,
  'triangulated-review':  AutonomyLevel.READ_ONLY,
  'overthinker':          AutonomyLevel.LOW,
  'bug-hunt':             AutonomyLevel.MEDIUM,
  'feature-design':       AutonomyLevel.MEDIUM,
  'auto-remediation':     AutonomyLevel.MEDIUM,
  'refactor-sprint':      AutonomyLevel.MEDIUM,
};

/**
 * Resolves "auto" to the minimum concrete AutonomyLevel for a given workflow.
 *
 * @param level - The autonomy level (concrete or "auto")
 * @param workflowName - Name of the workflow being executed
 * @returns Concrete AutonomyLevel
 */
export function resolveAutonomyLevel(
  level: AutonomyLevel | 'auto',
  workflowName: string
): AutonomyLevel {
  if (level !== 'auto') return level;
  return AUTO_LEVEL_MAP[workflowName] ?? AutonomyLevel.MEDIUM;
}

/**
 * Asserts that an operation is permitted at the given autonomy level.
 * Throws an error with a helpful message if not allowed.
 *
 * @param level - The current autonomy level
 * @param operation - The operation to check
 * @param context - Optional human-readable context for the error message
 * @throws Error if permission is denied
 */
export function assertPermission(
  level: AutonomyLevel,
  operation: OperationType,
  context?: string
): void {
  const result = checkPermission(level, operation);
  if (!result.allowed) {
    throw new Error(
      `Permission denied${context ? ` (${context})` : ''}: ${result.reason}. ` +
      `Grant '${result.requiredLevel}' or higher autonomy level to proceed.`
    );
  }
}




