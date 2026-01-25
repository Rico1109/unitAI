/**
 * Unit tests for dependencies.ts
 *
 * DI CONTAINER: Tests dependency injection initialization and lifecycle
 * Target Coverage: 85%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock CircuitBreaker
vi.mock('../../src/utils/circuitBreaker.js', () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    shutdown: vi.fn(),
  })),
}));

// Mock better-sqlite3
const mockDatabase = vi.fn();
const mockDbInstance = {
  pragma: vi.fn(),
  close: vi.fn(),
};

vi.mock('better-sqlite3', () => ({
  default: mockDatabase,
}));

// Mock fs
const mockFs = {
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
};
vi.mock('fs', () => ({
  default: mockFs,
  ...mockFs,
}));

// Mock path (use actual implementation for most functions)
vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return actual;
});

describe('dependencies', () => {
  let dependencies: typeof import('../../src/dependencies');

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    mockDatabase.mockReturnValue(mockDbInstance);
    mockFs.existsSync.mockReturnValue(true);

    // Reset module to clear singleton
    vi.resetModules();
    dependencies = await import('../../src/dependencies');
  });

  afterEach(() => {
    // Cleanup
    try {
      dependencies.closeDependencies();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  // =================================================================
  // Suite 1: Singleton Pattern
  // =================================================================
  describe('Singleton Pattern', () => {
    it('should throw error when getDependencies called before init', () => {
      // Act & Assert
      expect(() => dependencies.getDependencies()).toThrow(
        'Dependencies not initialized. Call initializeDependencies() first.'
      );
    });

    it('should return same instance on multiple calls', () => {
      // Act
      const deps1 = dependencies.initializeDependencies();
      const deps2 = dependencies.getDependencies();
      const deps3 = dependencies.initializeDependencies(); // Should return cached

      // Assert
      expect(deps1).toBe(deps2);
      expect(deps2).toBe(deps3);
    });

    it('should reset singleton after closeDependencies', () => {
      // Arrange
      dependencies.initializeDependencies();
      expect(() => dependencies.getDependencies()).not.toThrow();

      // Act
      dependencies.closeDependencies();

      // Assert
      expect(() => dependencies.getDependencies()).toThrow(
        'Dependencies not initialized'
      );
    });
  });

  // =================================================================
  // Suite 2: Directory Setup
  // =================================================================
  describe('Directory Setup', () => {
    it('should create data directory if it does not exist', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      dependencies.initializeDependencies();

      // Assert
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        { recursive: true }
      );
    });

    it('should not create directory if it already exists', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(true);

      // Act
      dependencies.initializeDependencies();

      // Assert
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  // =================================================================
  // Suite 3: Database Initialization
  // =================================================================
  describe('Database Initialization', () => {
    it('should create three databases', () => {
      // Act
      dependencies.initializeDependencies();

      // Assert: 3 Database instances created
      expect(mockDatabase).toHaveBeenCalledTimes(3);
      expect(mockDatabase).toHaveBeenCalledWith(
        expect.stringContaining('activity.sqlite')
      );
      expect(mockDatabase).toHaveBeenCalledWith(
        expect.stringContaining('audit.sqlite')
      );
      expect(mockDatabase).toHaveBeenCalledWith(
        expect.stringContaining('token-metrics.sqlite')
      );
    });

    it('should enable WAL mode for all databases', () => {
      // Act
      dependencies.initializeDependencies();

      // Assert: pragma called 3 times (once per DB)
      expect(mockDbInstance.pragma).toHaveBeenCalledTimes(3);
      expect(mockDbInstance.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    it('should return AppDependencies with all required properties', () => {
      // Act
      const deps = dependencies.initializeDependencies();

      // Assert
      expect(deps).toHaveProperty('activityDb');
      expect(deps).toHaveProperty('auditDb');
      expect(deps).toHaveProperty('tokenDb');
      expect(deps).toHaveProperty('circuitBreaker');
    });
  });

  // =================================================================
  // Suite 4: Circuit Breaker Initialization
  // =================================================================
  describe('Circuit Breaker Initialization', () => {
    it('should initialize circuit breaker with audit database', async () => {
      // Arrange
      const { CircuitBreaker } = await import('../../src/utils/circuitBreaker.js');

      // Act
      dependencies.initializeDependencies();

      // Assert
      expect(CircuitBreaker).toHaveBeenCalledWith(
        3,                // failure threshold
        5 * 60 * 1000,    // 5 minutes timeout
        expect.anything() // auditDb
      );
    });
  });

  // =================================================================
  // Suite 5: Cleanup
  // =================================================================
  describe('Cleanup', () => {
    it('should call shutdown on circuit breaker', () => {
      // Arrange
      const deps = dependencies.initializeDependencies();

      // Act
      dependencies.closeDependencies();

      // Assert
      expect(deps.circuitBreaker.shutdown).toHaveBeenCalled();
    });

    it('should close all three databases', () => {
      // Arrange
      dependencies.initializeDependencies();

      // Act
      dependencies.closeDependencies();

      // Assert: close called 3 times (one per DB)
      expect(mockDbInstance.close).toHaveBeenCalledTimes(3);
    });

    it('should handle circuit breaker shutdown errors gracefully', () => {
      // Arrange
      const deps = dependencies.initializeDependencies();
      deps.circuitBreaker.shutdown = vi.fn(() => {
        throw new Error('Shutdown error');
      });

      // Act & Assert: Should not throw
      expect(() => dependencies.closeDependencies()).not.toThrow();
    });

    it('should handle database close errors gracefully', () => {
      // Arrange
      dependencies.initializeDependencies();
      mockDbInstance.close.mockImplementation(() => {
        throw new Error('Close error');
      });

      // Act & Assert: Should not throw
      expect(() => dependencies.closeDependencies()).not.toThrow();
    });

    it('should handle multiple closeDependencies calls safely', () => {
      // Arrange
      dependencies.initializeDependencies();

      // Act & Assert
      expect(() => {
        dependencies.closeDependencies();
        dependencies.closeDependencies(); // Second call should be safe
        dependencies.closeDependencies(); // Third call should be safe
      }).not.toThrow();
    });

    it('should reset singleton to null after close', () => {
      // Arrange
      dependencies.initializeDependencies();

      // Act
      dependencies.closeDependencies();

      // Assert: getDependencies should now throw
      expect(() => dependencies.getDependencies()).toThrow(
        'Dependencies not initialized'
      );
    });
  });

  // =================================================================
  // Suite 6: Integration
  // =================================================================
  describe('Integration', () => {
    it('should allow re-initialization after close', () => {
      // Arrange
      dependencies.initializeDependencies();
      dependencies.closeDependencies();

      // Act & Assert: Should be able to init again
      expect(() => dependencies.initializeDependencies()).not.toThrow();
      expect(() => dependencies.getDependencies()).not.toThrow();
    });

    it('should create fresh instances after re-initialization', () => {
      // Arrange
      const deps1 = dependencies.initializeDependencies();
      dependencies.closeDependencies();

      // Reset mock call counts
      vi.clearAllMocks();
      mockDatabase.mockReturnValue(mockDbInstance);

      // Act
      const deps2 = dependencies.initializeDependencies();

      // Assert: New Database instances created
      expect(mockDatabase).toHaveBeenCalledTimes(3);
      // Note: In actual code these would be different instances,
      // but in our mock they point to the same mockDbInstance
    });
  });
});
