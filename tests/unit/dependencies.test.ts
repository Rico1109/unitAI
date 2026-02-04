/**
 * Unit tests for dependencies.ts
 *
 * DI CONTAINER: Tests dependency injection initialization and lifecycle
 * Target Coverage: 85%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { AsyncDatabase } from '../../src/infrastructure/async-db.js';

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
vi.mock('../../src/utils/reliability/index.js', () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    shutdown: vi.fn(),
  })),
}));

// Mock AsyncDatabase
vi.mock('../../src/infrastructure/async-db.js', () => ({
  AsyncDatabase: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    execAsync: vi.fn().mockResolvedValue(undefined),
    closeAsync: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock better-sqlite3
const mockDatabase = vi.fn();
const mockStatement = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn().mockReturnValue([]),
};
const mockDbInstance = {
  pragma: vi.fn(),
  close: vi.fn(),
  exec: vi.fn(),
  prepare: vi.fn().mockReturnValue(mockStatement),
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

  afterEach(async () => {
    // Cleanup
    try {
      await dependencies.closeDependencies();
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

    it('should return same instance on multiple calls', async () => {
      // Act
      const deps1 = await dependencies.initializeDependencies();
      const deps2 = dependencies.getDependencies();
      const deps3 = await dependencies.initializeDependencies(); // Should return cached

      // Assert
      expect(deps1).toBe(deps2);
      expect(deps2).toBe(deps3);
    });

    it('should reset singleton after closeDependencies', async () => {
      // Arrange
      await dependencies.initializeDependencies();
      expect(() => dependencies.getDependencies()).not.toThrow();

      // Act
      await dependencies.closeDependencies();

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
    it('should create data directory if it does not exist', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      await dependencies.initializeDependencies();

      // Assert
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        { recursive: true }
      );
    });

    it('should not create directory if it already exists', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(true);

      // Act
      await dependencies.initializeDependencies();

      // Assert
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  // =================================================================
  // Suite 3: Database Initialization
  // =================================================================
  describe('Database Initialization', () => {
    it('should create databases (sync and async)', async () => {
      // Act
      await dependencies.initializeDependencies();

      // Assert: 2 Sync Database instances created (audit, token)
      expect(mockDatabase).toHaveBeenCalledTimes(2);
      expect(mockDatabase).toHaveBeenCalledWith(
        expect.stringContaining('audit.sqlite')
      );
      expect(mockDatabase).toHaveBeenCalledWith(
        expect.stringContaining('token-metrics.sqlite')
      );

      // Assert: 4 AsyncDatabase instances created
      expect(AsyncDatabase).toHaveBeenCalledTimes(4);
      expect(AsyncDatabase).toHaveBeenCalledWith(expect.stringContaining('activity.sqlite'));
      expect(AsyncDatabase).toHaveBeenCalledWith(expect.stringContaining('audit.sqlite'));
      expect(AsyncDatabase).toHaveBeenCalledWith(expect.stringContaining('token-metrics.sqlite'));
      expect(AsyncDatabase).toHaveBeenCalledWith(expect.stringContaining('red-metrics.sqlite'));
    });

    it('should enable WAL mode for sync databases', async () => {
      // Act
      await dependencies.initializeDependencies();

      // Assert: pragma called 2 times (once per Sync DB)
      expect(mockDbInstance.pragma).toHaveBeenCalledTimes(2);
      expect(mockDbInstance.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    it('should return AppDependencies with all required properties', async () => {
      // Act
      const deps = await dependencies.initializeDependencies();

      // Assert
      expect(deps).toHaveProperty('activityDb');
      expect(deps).toHaveProperty('auditDb');
      expect(deps).toHaveProperty('tokenDb');
      expect(deps).toHaveProperty('metricsDb');
      expect(deps).toHaveProperty('circuitBreaker');
    });
  });

  // =================================================================
  // Suite 4: Circuit Breaker Initialization
  // =================================================================
  describe('Circuit Breaker Initialization', () => {
    it('should initialize circuit breaker with audit database', async () => {
      // Arrange
      const { CircuitBreaker } = await import('../../src/utils/reliability/index.js');

      // Act
      await dependencies.initializeDependencies();

      // Assert
      expect(CircuitBreaker).toHaveBeenCalledWith(
        3,                // failure threshold
        5 * 60 * 1000,    // 5 minutes timeout
        expect.anything() // auditDb (sync)
      );
    });
  });

  // =================================================================
  // Suite 5: Cleanup
  // =================================================================
  describe('Cleanup', () => {
    it('should call shutdown on circuit breaker', async () => {
      // Arrange
      const deps = await dependencies.initializeDependencies();

      // Act
      await dependencies.closeDependencies();

      // Assert
      expect(deps.circuitBreaker.shutdown).toHaveBeenCalled();
    });

    it('should close databases', async () => {
      // Arrange
      await dependencies.initializeDependencies();
      const asyncDbInstances = vi.mocked(AsyncDatabase).mock.results.map(r => r.value);

      // Act
      await dependencies.closeDependencies();

      // Assert: close called 2 times (one per Sync DB)
      expect(mockDbInstance.close).toHaveBeenCalledTimes(2);

      // Assert: closeAsync called on all async DBs
      asyncDbInstances.forEach(db => {
          expect(db.closeAsync).toHaveBeenCalled();
      });
    });

    it('should handle circuit breaker shutdown errors gracefully', async () => {
      // Arrange
      const deps = await dependencies.initializeDependencies();
      deps.circuitBreaker.shutdown = vi.fn(() => {
        throw new Error('Shutdown error');
      });

      // Act & Assert: Should not throw
      await expect(dependencies.closeDependencies()).resolves.not.toThrow();
    });

    it('should handle database close errors gracefully', async () => {
      // Arrange
      await dependencies.initializeDependencies();
      mockDbInstance.close.mockImplementation(() => {
        throw new Error('Close error');
      });

      // Act & Assert: Should not throw
      await expect(dependencies.closeDependencies()).resolves.not.toThrow();
    });

    it('should handle multiple closeDependencies calls safely', async () => {
      // Arrange
      await dependencies.initializeDependencies();

      // Act & Assert - multiple calls should complete without throwing
      await dependencies.closeDependencies();
      await dependencies.closeDependencies(); // Second call should be safe
      await dependencies.closeDependencies(); // Third call should be safe
      // Test passes if no error thrown
    });

    it('should reset singleton to null after close', async () => {
      // Arrange
      await dependencies.initializeDependencies();

      // Act
      await dependencies.closeDependencies();

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
    it('should allow re-initialization after close', async () => {
      // Arrange
      await dependencies.initializeDependencies();
      await dependencies.closeDependencies();

      // Act & Assert: Should be able to init again
      await expect(dependencies.initializeDependencies()).resolves.not.toThrow();
      expect(() => dependencies.getDependencies()).not.toThrow();
    });

    it('should create fresh instances after re-initialization', async () => {
      // Arrange
      await dependencies.initializeDependencies();
      await dependencies.closeDependencies();

      // Reset mock call counts
      vi.clearAllMocks();
      mockDatabase.mockReturnValue(mockDbInstance);
      vi.mocked(AsyncDatabase).mockClear();

      // Act
      await dependencies.initializeDependencies();

      // Assert: New Database instances created
      expect(mockDatabase).toHaveBeenCalledTimes(2);
      expect(AsyncDatabase).toHaveBeenCalledTimes(4);
    });
  });
});