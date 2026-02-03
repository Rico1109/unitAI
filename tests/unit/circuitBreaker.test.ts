/**
 * Unit tests for circuitBreaker.ts
 *
 * SECURITY/RELIABILITY: Tests circuit breaker state machine and persistence
 * Target Coverage: 85%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../../src/utils/reliability/circuitBreaker';
import Database from 'better-sqlite3';

// Mock logger to avoid console noise
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('circuitBreaker', () => {
  let db: Database.Database;
  let breaker: CircuitBreaker;
  const testBackend = 'test-backend';

  beforeEach(() => {
    // Create fresh in-memory database for each test
    db = new Database(':memory:');

    // Create circuit breaker with database (threshold=3, timeout=5min)
    breaker = new CircuitBreaker(3, 5 * 60 * 1000, db);
  });

  afterEach(() => {
    // Clean up
    db.close();
  });

  // =================================================================
  // Suite 1: State Transitions
  // =================================================================
  describe('State Transitions', () => {
    it('should start in CLOSED state', async () => {
      // Arrange & Act
      const states = breaker.getStates();

      // Assert: No states yet (lazy initialization)
      expect(states.size).toBe(0);
      expect(await breaker.isAvailable(testBackend)).toBe(true);
    });

    it('should transition CLOSED -> OPEN after threshold failures', async () => {
      // Arrange: threshold = 3
      expect(await breaker.isAvailable(testBackend)).toBe(true);

      // Act: Record 3 failures
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);

      // Assert
      const states = breaker.getStates();
      const state = states.get(testBackend);
      expect(state?.state).toBe(CircuitState.OPEN);
      expect(state?.failures).toBe(3);
      expect(await breaker.isAvailable(testBackend)).toBe(false);
    });

    it('should transition OPEN -> HALF_OPEN after timeout', async () => {
      // Arrange: Get into OPEN state
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);
      expect(await breaker.isAvailable(testBackend)).toBe(false);

      // Act: Simulate time passing (5 minutes + 1ms)
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now + 5 * 60 * 1000 + 1);

      const isAvailable = await breaker.isAvailable(testBackend);

      // Assert: Should transition to HALF_OPEN and allow trial
      expect(isAvailable).toBe(true);
      const states = breaker.getStates();
      const state = states.get(testBackend);
      expect(state?.state).toBe(CircuitState.HALF_OPEN);

      vi.useRealTimers();
    });

    it('should transition HALF_OPEN -> CLOSED on success', async () => {
      // Arrange: Get into HALF_OPEN state
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
      await breaker.isAvailable(testBackend); // Transitions to HALF_OPEN

      // Act: Success in HALF_OPEN
      await breaker.onSuccess(testBackend);

      // Assert: Should reset to CLOSED with 0 failures
      const states = breaker.getStates();
      const state = states.get(testBackend);
      expect(state?.state).toBe(CircuitState.CLOSED);
      expect(state?.failures).toBe(0);
      expect(await breaker.isAvailable(testBackend)).toBe(true);

      vi.useRealTimers();
    });

    it('should transition HALF_OPEN -> OPEN on failure', async () => {
      // Arrange: Get into HALF_OPEN state
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
      await breaker.isAvailable(testBackend); // Transitions to HALF_OPEN

      // Act: Failure in HALF_OPEN
      await breaker.onFailure(testBackend);

      // Assert: Should go back to OPEN
      const states = breaker.getStates();
      const state = states.get(testBackend);
      expect(state?.state).toBe(CircuitState.OPEN);
      expect(await breaker.isAvailable(testBackend)).toBe(false);

      vi.useRealTimers();
    });

    it('should reset failures on success in CLOSED state', async () => {
      // Arrange: Record some failures (but not enough to open)
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);

      let states = breaker.getStates();
      let state = states.get(testBackend);
      expect(state?.failures).toBe(2);

      // Act: Success resets counter
      await breaker.onSuccess(testBackend);

      // Assert
      states = breaker.getStates();
      state = states.get(testBackend);
      expect(state?.failures).toBe(0);
      expect(state?.state).toBe(CircuitState.CLOSED);
    });
  });

  // =================================================================
  // Suite 2: Database Persistence
  // =================================================================
  describe('Database Persistence', () => {
    it('should load state from database on initialization', () => {
      // Arrange: Insert state directly into DB
      db.prepare(`
        INSERT INTO circuit_breaker_state
        (backend, state, failures, last_failure_time)
        VALUES (?, ?, ?, ?)
      `).run('preloaded-backend', CircuitState.OPEN, 5, Date.now());

      // Act: Create new breaker instance (should load state)
      const newBreaker = new CircuitBreaker(3, 5 * 60 * 1000, db);

      // Assert
      const states = newBreaker.getStates();
      const state = states.get('preloaded-backend');
      expect(state?.state).toBe(CircuitState.OPEN);
      expect(state?.failures).toBe(5);
    });

    it('should save state on onSuccess()', async () => {
      // Arrange
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);

      // Act
      await breaker.onSuccess(testBackend);

      // Assert: Check database directly
      const row = db.prepare(
        'SELECT * FROM circuit_breaker_state WHERE backend = ?'
      ).get(testBackend) as any;

      expect(row).toBeDefined();
      expect(row.state).toBe(CircuitState.CLOSED);
      expect(row.failures).toBe(0);
    });

    it('should save state on onFailure()', async () => {
      // Act
      await breaker.onFailure(testBackend);

      // Assert: Check database directly
      const row = db.prepare(
        'SELECT * FROM circuit_breaker_state WHERE backend = ?'
      ).get(testBackend) as any;

      expect(row).toBeDefined();
      expect(row.failures).toBe(1);
      expect(row.last_failure_time).toBeGreaterThan(0);
    });

    it('should save state on transitionTo()', async () => {
      // Arrange: Force transition to OPEN
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);

      // Act: Third failure triggers transition
      await breaker.onFailure(testBackend);

      // Assert: Check database
      const row = db.prepare(
        'SELECT * FROM circuit_breaker_state WHERE backend = ?'
      ).get(testBackend) as any;

      expect(row).toBeDefined();
      expect(row.state).toBe(CircuitState.OPEN);
      expect(row.failures).toBe(3);
    });

    it('should persist final state on shutdown()', async () => {
      // Arrange: Modify state
      await breaker.onFailure('backend1');
      await breaker.onFailure('backend2');
      await breaker.onFailure('backend2');

      // Act: Shutdown
      breaker.shutdown();

      // Assert: Check database has both backends
      const rows = db.prepare(
        'SELECT * FROM circuit_breaker_state ORDER BY backend'
      ).all() as any[];

      expect(rows).toHaveLength(2);
      expect(rows[0].backend).toBe('backend1');
      expect(rows[0].failures).toBe(1);
      expect(rows[1].backend).toBe('backend2');
      expect(rows[1].failures).toBe(2);
    });

    it('should clear database on reset()', async () => {
      // Arrange: Add some state
      await breaker.onFailure(testBackend);
      await breaker.onFailure('backend2');

      let rows = db.prepare('SELECT * FROM circuit_breaker_state').all();
      expect(rows.length).toBeGreaterThan(0);

      // Act
      breaker.reset();

      // Assert: Database should be empty
      rows = db.prepare('SELECT * FROM circuit_breaker_state').all();
      expect(rows).toHaveLength(0);
      expect(breaker.getStates().size).toBe(0);
    });

    it('should create table if not exists', () => {
      // Arrange: New database
      const freshDb = new Database(':memory:');

      // Act: Initialize circuit breaker
      new CircuitBreaker(3, 5 * 60 * 1000, freshDb);

      // Assert: Table should exist
      const tables = freshDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='circuit_breaker_state'"
      ).all();

      expect(tables).toHaveLength(1);

      freshDb.close();
    });
  });

  // =================================================================
  // Suite 3: Availability Checks
  // =================================================================
  describe('Availability Checks', () => {
    it('should return true for CLOSED circuit', async () => {
      // Arrange: Circuit is CLOSED by default

      // Act & Assert
      expect(await breaker.isAvailable(testBackend)).toBe(true);
    });

    it('should return false for OPEN circuit', async () => {
      // Arrange: Open the circuit
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);

      // Act & Assert
      expect(await breaker.isAvailable(testBackend)).toBe(false);
    });

    it('should return true for HALF_OPEN circuit (one trial)', async () => {
      // Arrange: Get into OPEN state
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);

      // Wait for timeout
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);

      // Act & Assert: First call transitions to HALF_OPEN and returns true
      expect(await breaker.isAvailable(testBackend)).toBe(true);

      // State should be HALF_OPEN now
      const states = breaker.getStates();
      const state = states.get(testBackend);
      expect(state?.state).toBe(CircuitState.HALF_OPEN);

      vi.useRealTimers();
    });

    it('should transition OPEN -> HALF_OPEN after timeout expires', async () => {
      // Arrange: Open circuit
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);
      await breaker.onFailure(testBackend);

      vi.useFakeTimers();
      const baseTime = Date.now();

      // Act: Check before timeout
      vi.setSystemTime(baseTime + 4 * 60 * 1000); // 4 minutes
      expect(await breaker.isAvailable(testBackend)).toBe(false);

      // Check after timeout
      vi.setSystemTime(baseTime + 6 * 60 * 1000); // 6 minutes
      expect(await breaker.isAvailable(testBackend)).toBe(true);

      // Assert: Should be in HALF_OPEN
      const states = breaker.getStates();
      const state = states.get(testBackend);
      expect(state?.state).toBe(CircuitState.HALF_OPEN);

      vi.useRealTimers();
    });
  });

  // =================================================================
  // Suite 4: Multiple Backends
  // =================================================================
  describe('Multiple Backends', () => {
    it('should track state independently for each backend', async () => {
      // Arrange
      const backend1 = 'gemini';
      const backend2 = 'qwen';

      // Act: Fail backend1 (OPEN), leave backend2 alone
      await breaker.onFailure(backend1);
      await breaker.onFailure(backend1);
      await breaker.onFailure(backend1);

      // Assert
      expect(await breaker.isAvailable(backend1)).toBe(false); // OPEN
      expect(await breaker.isAvailable(backend2)).toBe(true);  // CLOSED

      const states = breaker.getStates();
      expect(states.get(backend1)?.state).toBe(CircuitState.OPEN);
      expect(states.get(backend2)?.state).toBe(CircuitState.CLOSED);
    });

    it('should persist all backends to database', async () => {
      // Arrange
      await breaker.onFailure('backend1');
      await breaker.onFailure('backend2');
      await breaker.onFailure('backend2');
      await breaker.onFailure('backend3');

      // Act
      breaker.shutdown();

      // Assert: All 3 in database
      const rows = db.prepare(
        'SELECT backend, failures FROM circuit_breaker_state ORDER BY backend'
      ).all() as any[];

      expect(rows).toHaveLength(3);
      expect(rows[0].backend).toBe('backend1');
      expect(rows[0].failures).toBe(1);
      expect(rows[1].backend).toBe('backend2');
      expect(rows[1].failures).toBe(2);
      expect(rows[2].backend).toBe('backend3');
      expect(rows[2].failures).toBe(1);
    });
  });

  // =================================================================
  // Suite 5: CircuitBreaker without Database
  // =================================================================
  describe('CircuitBreaker without Database', () => {
    it('should work without database (in-memory only)', async () => {
      // Arrange: Create breaker without DB
      const memoryBreaker = new CircuitBreaker(2, 1000);

      // Act: Fail backend
      await memoryBreaker.onFailure('test');
      await memoryBreaker.onFailure('test');

      // Assert: Circuit should open
      expect(await memoryBreaker.isAvailable('test')).toBe(false);

      const states = memoryBreaker.getStates();
      expect(states.get('test')?.state).toBe(CircuitState.OPEN);
    });

    it('should not throw when calling shutdown without DB', async () => {
      // Arrange
      const memoryBreaker = new CircuitBreaker(2, 1000);
      await memoryBreaker.onFailure('test');

      // Act & Assert: Should not throw
      expect(() => memoryBreaker.shutdown()).not.toThrow();
    });

    it('should not throw when calling reset without DB', async () => {
      // Arrange
      const memoryBreaker = new CircuitBreaker(2, 1000);
      await memoryBreaker.onFailure('test');

      // Act & Assert: Should not throw
      expect(() => memoryBreaker.reset()).not.toThrow();
    });
  });

  // =================================================================
  // Suite 6: Custom Configuration
  // =================================================================
  describe('Custom Configuration', () => {
    it('should use custom failure threshold', async () => {
      // Arrange: threshold = 5
      const customBreaker = new CircuitBreaker(5, 1000, db);

      // Act: 4 failures (below threshold)
      await customBreaker.onFailure('test');
      await customBreaker.onFailure('test');
      await customBreaker.onFailure('test');
      await customBreaker.onFailure('test');

      // Assert: Still closed
      expect(await customBreaker.isAvailable('test')).toBe(true);

      // 5th failure opens it
      await customBreaker.onFailure('test');
      expect(await customBreaker.isAvailable('test')).toBe(false);
    });

    it('should use custom reset timeout', async () => {
      // Arrange: timeout = 1 second
      const customBreaker = new CircuitBreaker(2, 1000, db);

      await customBreaker.onFailure('test');
      await customBreaker.onFailure('test');
      expect(await customBreaker.isAvailable('test')).toBe(false);

      vi.useFakeTimers();

      // Act: Wait 1 second
      vi.setSystemTime(Date.now() + 1001);

      // Assert: Should transition to HALF_OPEN
      expect(await customBreaker.isAvailable('test')).toBe(true);

      const states = customBreaker.getStates();
      expect(states.get('test')?.state).toBe(CircuitState.HALF_OPEN);

      vi.useRealTimers();
    });
  });
});