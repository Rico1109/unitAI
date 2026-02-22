import { vi } from 'vitest';

/**
 * Creates a mock instance of a single CircuitBreaker.
 * This is the object returned by `circuitBreakerRegistry.get(name)`.
 */
export const createMockCircuitBreaker = () => ({
  isAvailable: vi.fn().mockReturnValue(true),   // sync — matches new CircuitBreaker impl
  onSuccess: vi.fn(),
  onFailure: vi.fn(),
  execute: vi.fn(async (fn: () => unknown) => fn()),
  getState: vi.fn().mockReturnValue('CLOSED'),
  reset: vi.fn(),
  shutdown: vi.fn(),
});

/**
 * Creates a mock for CircuitBreakerRegistry.
 * `.get(name)` returns a reusable mock breaker instance.
 */
export const createMockCircuitBreakerRegistry = () => {
  const mockBreaker = createMockCircuitBreaker();
  return {
    get: vi.fn().mockReturnValue(mockBreaker),
    resetAll: vi.fn(),
    getAllStats: vi.fn().mockReturnValue({}),
    _mockBreaker: mockBreaker,   // expose for per-test assertions
  };
};

/**
 * Standard mock dependencies object for use in vi.mock('../src/dependencies.js').
 */
export const createMockDependencies = () => ({
  activityDb: {},
  auditDb: {},
  tokenDb: {},
  metricsDb: {},
  circuitBreaker: createMockCircuitBreakerRegistry(),
});
