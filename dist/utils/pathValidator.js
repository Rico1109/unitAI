/**
 * Path Validation Utilities
 *
 * SECURITY: Prevent path traversal attacks in file attachments
 */
import { existsSync, statSync } from "fs";
import path from "path";
// Maximum file size for attachments (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
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
export function validateFilePath(filePath) {
    const resolved = path.resolve(filePath);
    const projectRoot = path.resolve(process.cwd());
    // 1. Must be within project directory
    if (!resolved.startsWith(projectRoot)) {
        throw new Error(`File outside project directory: ${filePath}`);
    }
    // 2. No traversal sequences
    if (filePath.includes("..")) {
        throw new Error(`Path traversal detected: ${filePath}`);
    }
    // 3. File must exist
    if (!existsSync(resolved)) {
        throw new Error(`File not found: ${filePath}`);
    }
    // 4. Size limit check
    const stats = statSync(resolved);
    if (stats.size > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${filePath} (${stats.size} bytes, max ${MAX_FILE_SIZE} bytes)`);
    }
    return resolved;
}
/**
 * Validate multiple file paths
 *
 * @param filePaths - Array of paths to validate
 * @returns Array of resolved absolute paths
 * @throws Error if any path is invalid
 */
export function validateFilePaths(filePaths) {
    return filePaths.map((filePath) => validateFilePath(filePath));
}
//# sourceMappingURL=pathValidator.js.map