/**
 * Reliability Utilities
 *
 * Reliability and resilience utilities including circuit breakers
 * and error recovery mechanisms.
 */

// Export DB-backed CircuitBreaker as primary
export { CircuitBreaker, CircuitState } from './circuitBreaker.js';

// Export in-memory CircuitBreaker with different name to avoid conflict
export {
    CircuitBreaker as InMemoryCircuitBreaker,
    CircuitState as InMemoryCircuitState,
    CircuitBreakerRegistry
} from './errorRecovery.js';
