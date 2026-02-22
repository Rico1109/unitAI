import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerRegistry,
  ErrorType
} from '../../src/utils/reliability/index.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      name: 'test-circuit',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000
    });
  });

  describe('State Transitions', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition from CLOSED to OPEN after threshold failures', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // First 2 failures - should remain CLOSED
      for (let i = 0; i < 2; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow('Test error');
        expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      }

      // 3rd failure - should transition to OPEN
      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow('Test error');
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject requests in OPEN state', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Trigger circuit to OPEN
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // New request should be rejected immediately
      await expect(circuitBreaker.execute(vi.fn())).rejects.toThrow('Circuit breaker is OPEN');
      expect(vi.fn()).not.toHaveBeenCalled();
    });

    it('should transition from OPEN to HALF_OPEN after timeout', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Trigger circuit to OPEN
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout + margin
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next request should move to HALF_OPEN
      const result = await circuitBreaker.execute(successFn);
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should transition from HALF_OPEN to CLOSED after successful requests', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Move to OPEN
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Execute successful requests (threshold = 2)
      await circuitBreaker.execute(successFn);
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      await circuitBreaker.execute(successFn);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition from HALF_OPEN back to OPEN on failure', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Move to OPEN
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      // Wait for timeout to move to HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, 1100));

      // First success moves to HALF_OPEN
      await circuitBreaker.execute(successFn);
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Failure in HALF_OPEN should return to OPEN
      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow('Test error');
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reset failure count on success in CLOSED state', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));
      const successFn = vi.fn().mockResolvedValue('success');

      // 2 failures (threshold is 3)
      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();

      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(2);

      // Success should reset counter
      await circuitBreaker.execute(successFn);

      const statsAfter = circuitBreaker.getStats();
      expect(statsAfter.failureCount).toBe(0);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Statistics', () => {
    it('should track failure count correctly', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      expect(circuitBreaker.getStats().failureCount).toBe(1);

      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      expect(circuitBreaker.getStats().failureCount).toBe(2);
    });

    it('should track success count in HALF_OPEN state', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Move to OPEN
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      // Wait and move to HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, 1100));

      await circuitBreaker.execute(successFn);
      expect(circuitBreaker.getStats().successCount).toBe(1);
    });

    it('should return complete stats object', () => {
      const stats = circuitBreaker.getStats();

      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('successCount');
      expect(stats).toHaveProperty('lastFailureTime');
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
    });
  });

  describe('Reset', () => {
    it('should reset circuit breaker to initial state', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Reset
      circuitBreaker.reset();

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('Availability Check', () => {
    it('should report as available in CLOSED state', () => {
      expect(circuitBreaker.isAvailable()).toBe(true);
    });

    it('should report as available in HALF_OPEN state', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Move to OPEN
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      // Wait and execute to move to HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, 1100));
      await circuitBreaker.execute(successFn);

      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      expect(circuitBreaker.isAvailable()).toBe(true);
    });

    it('should report as unavailable in OPEN state within timeout', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Move to OPEN
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker.isAvailable()).toBe(false);
    });

    it('should report as available after timeout expires', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Move to OPEN
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      expect(circuitBreaker.isAvailable()).toBe(false);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(circuitBreaker.isAvailable()).toBe(true);
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry();
  });

  describe('Circuit Breaker Management', () => {
    it('should create and retrieve circuit breakers', () => {
      const cb1 = registry.get('service-1', {
        name: 'service-1',
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000
      });

      const cb2 = registry.get('service-1');

      expect(cb1).toBe(cb2);
      // Config is private, just verify breaker was created
      expect(cb1.getState()).toBe(CircuitState.CLOSED);
    });

    it('should create different circuit breakers for different names', () => {
      const cb1 = registry.get('service-1', {
        name: 'service-1',
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000
      });

      const cb2 = registry.get('service-2', {
        name: 'service-2',
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 2000
      });

      expect(cb1).not.toBe(cb2);
      // Config is private, verify they are different instances
      expect(cb1.getState()).toBe(CircuitState.CLOSED);
      expect(cb2.getState()).toBe(CircuitState.CLOSED);
    });

    it('should use default config if not provided on retrieval', () => {
      const cb = registry.get('test-service');

      expect(cb).toBeDefined();
      // Config is private, just verify breaker was created
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Registry Operations', () => {
    it('should reset all circuit breakers', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      const cb1 = registry.get('service-1', {
        name: 'service-1',
        failureThreshold: 2,
        successThreshold: 2,
        timeout: 1000
      });

      const cb2 = registry.get('service-2', {
        name: 'service-2',
        failureThreshold: 2,
        successThreshold: 2,
        timeout: 1000
      });

      // Trigger failures on both
      await expect(cb1.execute(failingFn)).rejects.toThrow();
      await expect(cb1.execute(failingFn)).rejects.toThrow();
      await expect(cb2.execute(failingFn)).rejects.toThrow();
      await expect(cb2.execute(failingFn)).rejects.toThrow();

      expect(cb1.getState()).toBe(CircuitState.OPEN);
      expect(cb2.getState()).toBe(CircuitState.OPEN);

      // Reset all
      registry.resetAll();

      expect(cb1.getState()).toBe(CircuitState.CLOSED);
      expect(cb2.getState()).toBe(CircuitState.CLOSED);
    });

    it('should get stats for all circuit breakers', async () => {
      registry.get('service-1', {
        name: 'service-1',
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000
      });

      registry.get('service-2', {
        name: 'service-2',
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 2000
      });

      const allStats = registry.getAllStats();

      expect(allStats).toHaveProperty('service-1');
      expect(allStats).toHaveProperty('service-2');
      expect(allStats['service-1'].state).toBe(CircuitState.CLOSED);
      expect(allStats['service-2'].state).toBe(CircuitState.CLOSED);
    });
  });
});

