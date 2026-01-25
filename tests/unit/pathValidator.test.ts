/**
 * Unit tests for pathValidator.ts
 *
 * SECURITY: Tests path validation and traversal attack prevention
 * Target Coverage: 95%+
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateFilePath, validateFilePaths } from '../../src/utils/pathValidator';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync } from 'fs';
import path from 'path';

describe('pathValidator', () => {
  const projectRoot = process.cwd();
  const testDir = path.join(projectRoot, 'tests', 'fixtures');

  // Test files
  const validFile = path.join(testDir, 'test-file.ts');
  const largeFile = path.join(testDir, 'large-file.txt');
  const testFiles: string[] = [];

  beforeEach(() => {
    // Ensure test directory exists
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    // Create valid test file
    writeFileSync(validFile, 'export const test = true;');
    testFiles.push(validFile);
  });

  afterEach(() => {
    // Clean up test files
    testFiles.forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
    testFiles.length = 0;
  });

  // =================================================================
  // Suite 1: Project Boundary
  // =================================================================
  describe('Project Boundary', () => {
    it('should allow files within project directory', () => {
      // Arrange: validFile is in project

      // Act
      const result = validateFilePath(validFile);

      // Assert
      expect(result).toBe(path.resolve(validFile));
      expect(result.startsWith(projectRoot)).toBe(true);
    });

    it('should reject files outside project directory', () => {
      // Arrange
      const outsidePath = '/tmp/outside.ts';

      // Act & Assert
      expect(() => validateFilePath(outsidePath)).toThrow(
        'File outside project directory: /tmp/outside.ts'
      );
    });

    it('should resolve relative paths correctly', () => {
      // Arrange
      const relativePath = 'tests/fixtures/test-file.ts';

      // Act
      const result = validateFilePath(relativePath);

      // Assert
      expect(result).toBe(path.resolve(projectRoot, relativePath));
      expect(result.startsWith(projectRoot)).toBe(true);
    });
  });

  // =================================================================
  // Suite 2: Path Traversal Detection
  // =================================================================
  describe('Path Traversal Detection', () => {
    it('should reject paths with .. sequences', () => {
      // Arrange: Path with .. that stays in project but has traversal
      const traversalPath = 'tests/../tests/fixtures/../fixtures/test-file.ts';

      // Act & Assert
      expect(() => validateFilePath(traversalPath)).toThrow(
        'Path traversal detected:'
      );
    });

    it('should reject paths with multiple ../../../', () => {
      // Arrange: Paths that exit project fail on boundary check first
      const traversalPath = '../../../../../root/.ssh/id_rsa';

      // Act & Assert
      // Note: This fails on boundary check, not traversal check (boundary is first)
      expect(() => validateFilePath(traversalPath)).toThrow(
        'File outside project directory:'
      );
    });

    it('should allow legitimate paths without traversal', () => {
      // Arrange: validFile has no .. sequences

      // Act
      const result = validateFilePath(validFile);

      // Assert
      expect(result).toBe(path.resolve(validFile));
    });
  });

  // =================================================================
  // Suite 3: File Existence
  // =================================================================
  describe('File Existence', () => {
    it('should reject non-existent files', () => {
      // Arrange
      const nonExistent = path.join(testDir, 'does-not-exist.ts');

      // Act & Assert
      expect(() => validateFilePath(nonExistent)).toThrow(
        'File not found:'
      );
    });

    it('should accept existing files', () => {
      // Arrange: validFile exists

      // Act
      const result = validateFilePath(validFile);

      // Assert
      expect(result).toBe(path.resolve(validFile));
      expect(existsSync(result)).toBe(true);
    });

    it('should validate before size check', () => {
      // Arrange: Non-existent file (existence fails before size check)
      const nonExistent = path.join(testDir, 'missing.ts');

      // Act & Assert
      expect(() => validateFilePath(nonExistent)).toThrow(
        'File not found:'
      );
    });
  });

  // =================================================================
  // Suite 4: File Size Limits
  // =================================================================
  describe('File Size Limits', () => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    it('should reject files over MAX_FILE_SIZE', () => {
      // Arrange: Create 11MB file
      const largeContent = 'x'.repeat(11 * 1024 * 1024);
      writeFileSync(largeFile, largeContent);
      testFiles.push(largeFile);

      // Act & Assert
      expect(() => validateFilePath(largeFile)).toThrow(
        /File too large:.*\(11534336 bytes, max 10485760 bytes\)/
      );
    });

    it('should accept files under limit', () => {
      // Arrange: validFile is small (< 10MB)

      // Act
      const result = validateFilePath(validFile);

      // Assert
      expect(result).toBe(path.resolve(validFile));
    });

    it('should report correct size in error', () => {
      // Arrange: Create file with known size
      const testContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      writeFileSync(largeFile, testContent);
      testFiles.push(largeFile);

      // Act & Assert
      expect(() => validateFilePath(largeFile)).toThrow(
        `File too large: ${largeFile} (11534336 bytes, max ${MAX_FILE_SIZE} bytes)`
      );
    });
  });

  // =================================================================
  // Suite 5: Batch Validation
  // =================================================================
  describe('Batch Validation', () => {
    it('should validate array of paths', () => {
      // Arrange
      const file1 = path.join(testDir, 'test1.ts');
      const file2 = path.join(testDir, 'test2.ts');
      writeFileSync(file1, 'test1');
      writeFileSync(file2, 'test2');
      testFiles.push(file1, file2);

      // Act
      const result = validateFilePaths([file1, file2]);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(path.resolve(file1));
      expect(result[1]).toBe(path.resolve(file2));
    });

    it('should fail on first invalid path', () => {
      // Arrange
      const file1 = path.join(testDir, 'valid.ts');
      const file2 = '/tmp/outside.ts'; // Invalid
      writeFileSync(file1, 'valid');
      testFiles.push(file1);

      // Act & Assert
      expect(() => validateFilePaths([file1, file2])).toThrow(
        'File outside project directory:'
      );
    });

    it('should return validated paths', () => {
      // Arrange
      const relativePath = 'tests/fixtures/test-file.ts';

      // Act
      const result = validateFilePaths([relativePath]);

      // Assert
      expect(result[0]).toBe(path.resolve(projectRoot, relativePath));
    });
  });
});
