/**
 * Circuit Breaker for AI Backends
 * 
 * Implements a state machine to track backend health and prevent cascading failures.
 * States:
 * - CLOSED: Normal operation, requests allowed.
 * - OPEN: Backend failed too many times, requests blocked.
 * - HALF_OPEN: Testing backend recovery, limited requests allowed.
 */

import { logger } from "./logger.js";

export enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}

interface CircuitConfig {
    failureThreshold: number; // Number of failures before opening
    resetTimeoutMs: number;   // Time to wait before trying again (Half-Open)
}

interface BackendState {
    state: CircuitState;
    failures: number;
    lastFailureTime: number;
}

export class CircuitBreaker {
    private static instance: CircuitBreaker;
    private states: Map<string, BackendState> = new Map();

    private config: CircuitConfig = {
        failureThreshold: 3,
        resetTimeoutMs: 5 * 60 * 1000 // 5 minutes
    };

    private constructor() { }

    public static getInstance(): CircuitBreaker {
        if (!CircuitBreaker.instance) {
            CircuitBreaker.instance = new CircuitBreaker();
        }
        return CircuitBreaker.instance;
    }

    /**
     * Check if a backend is available
     */
    public isAvailable(backend: string): boolean {
        const state = this.getState(backend);

        if (state.state === CircuitState.OPEN) {
            const now = Date.now();
            if (now - state.lastFailureTime > this.config.resetTimeoutMs) {
                this.transitionTo(backend, CircuitState.HALF_OPEN);
                return true; // Allow one trial request
            }
            return false;
        }

        return true;
    }

    /**
     * Record a successful execution
     */
    public onSuccess(backend: string): void {
        const state = this.getState(backend);
        if (state.state === CircuitState.HALF_OPEN) {
            this.transitionTo(backend, CircuitState.CLOSED);
            logger.info(`[CircuitBreaker] Backend ${backend} recovered. Circuit CLOSED.`);
        } else if (state.failures > 0) {
            // Reset failures on success in CLOSED state
            state.failures = 0;
            this.states.set(backend, state);
        }
    }

    /**
     * Record a failed execution
     */
    public onFailure(backend: string): void {
        const state = this.getState(backend);
        state.failures++;
        state.lastFailureTime = Date.now();

        if (state.state === CircuitState.HALF_OPEN) {
            this.transitionTo(backend, CircuitState.OPEN);
            logger.warn(`[CircuitBreaker] Backend ${backend} failed recovery check. Circuit OPEN.`);
        } else if (state.state === CircuitState.CLOSED && state.failures >= this.config.failureThreshold) {
            this.transitionTo(backend, CircuitState.OPEN);
            logger.error(`[CircuitBreaker] Backend ${backend} reached failure threshold. Circuit OPEN.`);
        } else {
            this.states.set(backend, state);
        }
    }

    /**
     * Get current state for a backend
     */
    private getState(backend: string): BackendState {
        if (!this.states.has(backend)) {
            this.states.set(backend, {
                state: CircuitState.CLOSED,
                failures: 0,
                lastFailureTime: 0
            });
        }
        return this.states.get(backend)!;
    }

    /**
     * Transition backend to a new state
     */
    private transitionTo(backend: string, newState: CircuitState): void {
        const state = this.getState(backend);
        state.state = newState;
        if (newState === CircuitState.CLOSED) {
            state.failures = 0;
        }
        this.states.set(backend, state);
    }

    /**
     * Reset all states (for testing)
     */
    public reset(): void {
        this.states.clear();
    }
}

export const circuitBreaker = CircuitBreaker.getInstance();
