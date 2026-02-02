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
/**
 * SECURITY: Validate path for file writing operations
 *
 * Checks:
 * 1. Path must be within allowed directory (or relative to it)
 * 2. No path traversal sequences (..) in the path
 * 3. Resolves to an absolute path within bounds
 *
 * Unlike validateFilePath, this does NOT check if the file exists,
 * making it suitable for validating output file paths.
 *
 * @param filePath - Path to validate
 * @param allowedBaseDir - Base directory that the path must be within (defaults to process.cwd())
 * @returns Resolved absolute path if valid
 * @throws Error if path is invalid or unsafe
 */
export declare function validatePath(filePath: string, allowedBaseDir?: string): string;
//# sourceMappingURL=pathValidator.d.ts.map