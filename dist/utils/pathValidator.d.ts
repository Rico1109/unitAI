/**
 * Path Validation Utilities
 *
 * SECURITY: Prevent path traversal attacks in file attachments
 */
/**
 * SECURITY: Validate file path to prevent path traversal attacks
 *
 * Checks:
 * 1. File must be within project directory
 * 2. No path traversal sequences (..)
 * 3. File must exist
 * 4. File size must be within limits
 *
 * @param filePath - Path to validate
 * @returns Resolved absolute path if valid
 * @throws Error if path is invalid or unsafe
 */
export declare function validateFilePath(filePath: string): string;
/**
 * Validate multiple file paths
 *
 * @param filePaths - Array of paths to validate
 * @returns Array of resolved absolute paths
 * @throws Error if any path is invalid
 */
export declare function validateFilePaths(filePaths: string[]): string[];
//# sourceMappingURL=pathValidator.d.ts.map