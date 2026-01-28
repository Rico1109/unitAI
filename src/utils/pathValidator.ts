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
export function validateFilePath(filePath: string): string {
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
    throw new Error(
      `File too large: ${filePath} (${stats.size} bytes, max ${MAX_FILE_SIZE} bytes)`
    );
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
export function validateFilePaths(filePaths: string[]): string[] {
  return filePaths.map((filePath) => validateFilePath(filePath));
}

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
export function validatePath(filePath: string, allowedBaseDir: string = process.cwd()): string {
  const resolved = path.resolve(allowedBaseDir, filePath);
  const baseDir = path.resolve(allowedBaseDir);

  // 1. Must be within allowed base directory
  if (!resolved.startsWith(baseDir)) {
    throw new Error(
      `Invalid output path: path traversal attempt detected. ` +
      `Path "${filePath}" resolves outside allowed directory "${baseDir}"`
    );
  }

  // 2. No traversal sequences in the input
  if (filePath.includes("..")) {
    throw new Error(
      `Invalid output path: path traversal attempt detected. ` +
      `Path "${filePath}" contains ".." sequences`
    );
  }

  return resolved;
}
