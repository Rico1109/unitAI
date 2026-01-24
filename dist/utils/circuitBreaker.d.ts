/**
 * Circuit Breaker for AI Backends
 *
 * Implements a state machine to track backend health and prevent cascading failures.
 * States:
 * - CLOSED: Normal operation, requests allowed.
 * - OPEN: Backend failed too many times, requests blocked.
 * - HALF_OPEN: Testing backend recovery, limited requests allowed.
 */
import type Database from 'better-sqlite3';
export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
interface BackendState {
    state: CircuitState;
    failures: number;
    lastFailureTime: number;
}
export declare class CircuitBreaker {
    private states;
    private db;
    private config;
    constructor(failureThreshold?: number, resetTimeoutMs?: number, db?: Database.Database);
    /**
     * Initialize circuit breaker state table
     */
    private initializeTable;
    /**
     * Load state from database
     */
    private loadState;
    /**
     * Save state for a specific backend to database
     */
    private saveState;
    /**
     * Check if a backend is available
     */
    isAvailable(backend: string): boolean;
    /**
     * Record a successful execution
     */
    onSuccess(backend: string): void;
    /**
     * Record a failed execution
     */
    onFailure(backend: string): void;
    /**
     * Get current state for a backend
     */
    private getState;
    /**
     * Transition backend to a new state
     */
    private transitionTo;
    /**
     * Reset all states (for testing and development)
     */
    reset(): void;
    /**
     * Shutdown - persist final state before closing
     */
    shutdown(): void;
    /**
     * Get current state for all backends (for debugging)
     */
    getStates(): Map<string, BackendState>;
}
export {};
//# sourceMappingURL=circuitBreaker.d.ts.map