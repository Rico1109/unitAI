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

// Mock CircuitBreakerRegistry (the new per-backend registry)
const mockGetAllStats = vi.fn().mockReturnValue({});
const mockRegistryInstance = {
  get: vi.fn().mockReturnValue({
    isAvailable: vi.fn().mockReturnValue(true),
    onSuccess: vi.fn(),
    onFailure: vi.fn(),
  }),
  getAllStats: mockGetAllStats,
  resetAll: vi.fn(),
};
const MockCircuitBreakerRegistry = vi.fn().mockImplementation(() => mockRegistryInstance);
// Keep MockCircuitBreaker for unused import compatibility
const MockCircuitBreaker = vi.fn();

vi.mock('../../src/utils/reliability/errorRecovery.js', () => ({
  CircuitBreaker: MockCircuitBreaker,
  CircuitBreakerRegistry: MockCircuitBreakerRegistry,
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
    mockGetAllStats.mockClear();
    MockCircuitBreakerRegistry.mockClear();

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
    it('should create databases (all async)', async () => {
      // Act
      await dependencies.initializeDependencies();

      // Assert: No Sync Database instances created
      expect(mockDatabase).toHaveBeenCalledTimes(0);

      // Assert: 4 AsyncDatabase instances created
      expect(AsyncDatabase).toHaveBeenCalledTimes(4);
      expect(AsyncDatabase).toHaveBeenCalledWith(expect.stringContaining('activity.sqlite'));
      expect(AsyncDatabase).toHaveBeenCalledWith(expect.stringContaining('audit.sqlite'));
      expect(AsyncDatabase).toHaveBeenCalledWith(expect.stringContaining('token-metrics.sqlite'));
      expect(AsyncDatabase).toHaveBeenCalledWith(expect.stringContaining('red-metrics.sqlite'));
    });

    it('should enable WAL mode for databases', async () => {
      // Act
      await dependencies.initializeDependencies();

      // Assert: AsyncDatabase.execAsync called for PRAGMA
      const asyncDbInstances = vi.mocked(AsyncDatabase).mock.results.map(r => r.value);
      asyncDbInstances.forEach(db => {
         expect(db.execAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL;');
      });
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
    it('should initialize circuit breaker registry', async () => {
      // Act
      await dependencies.initializeDependencies();

      // Assert: CircuitBreakerRegistry is instantiated (no args — each backend gets its own CB lazily)
      expect(MockCircuitBreakerRegistry).toHaveBeenCalledTimes(1);
      expect(MockCircuitBreakerRegistry).toHaveBeenCalledWith();
    });
  });

  // =================================================================
  // Suite 5: Cleanup
  // =================================================================
  describe('Cleanup', () => {
    it('should clean up circuit breaker state during close', async () => {
      // Arrange
      await dependencies.initializeDependencies();

      // Act
      await dependencies.closeDependencies();

      // Assert: getAllStats is called to iterate and clean up breakers
      expect(mockGetAllStats).toHaveBeenCalled();
    });

    it('should close databases', async () => {
      // Arrange
      await dependencies.initializeDependencies();
      const asyncDbInstances = vi.mocked(AsyncDatabase).mock.results.map(r => r.value);

      // Act
      await dependencies.closeDependencies();

      // Assert: close called 0 times (no Sync DBs)
      expect(mockDbInstance.close).toHaveBeenCalledTimes(0);

      // Assert: closeAsync called on all async DBs
      asyncDbInstances.forEach(db => {
          expect(db.closeAsync).toHaveBeenCalled();
      });
    });

    it('should handle circuit breaker cleanup errors gracefully', async () => {
      // Arrange
      await dependencies.initializeDependencies();
      // Simulate getAllStats throwing during cleanup
      mockGetAllStats.mockImplementationOnce(() => {
        throw new Error('Cleanup error');
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
      expect(mockDatabase).toHaveBeenCalledTimes(0);
      expect(AsyncDatabase).toHaveBeenCalledTimes(4);
    });
  });
});