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
import type Database from 'better-sqlite3';

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

interface CircuitStateRow {
    backend: string;
    state: string;
    failures: number;
    last_failure_time: number | null;
}

export class CircuitBreaker {
    private states: Map<string, BackendState> = new Map();
    private db: Database.Database | null = null;

    private config: CircuitConfig = {
        failureThreshold: 3,
        resetTimeoutMs: 5 * 60 * 1000 // 5 minutes
    };

    constructor(
        failureThreshold: number = 3,
        resetTimeoutMs: number = 5 * 60 * 1000,
        db?: Database.Database
    ) {
        this.config = {
            failureThreshold,
            resetTimeoutMs
        };

        if (db) {
            this.db = db;
            this.initializeTable();
            this.loadState();
        }
    }

    /**
     * Initialize circuit breaker state table
     */
    private initializeTable(): void {
        if (!this.db) return;

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS circuit_breaker_state (
                backend TEXT PRIMARY KEY,
                state TEXT NOT NULL,
                failures INTEGER NOT NULL DEFAULT 0,
                last_failure_time INTEGER
            )
        `);
    }

    /**
     * Load state from database
     */
    private loadState(): void {
        if (!this.db) return;

        try {
            const rows = this.db.prepare(
                'SELECT * FROM circuit_breaker_state'
            ).all() as CircuitStateRow[];

            for (const row of rows) {
                this.states.set(row.backend, {
                    state: row.state as CircuitState,
                    failures: row.failures,
                    lastFailureTime: row.last_failure_time || 0
                });
            }

            logger.debug(`[CircuitBreaker] Loaded ${rows.length} backend states from database`);
        } catch (error) {
            logger.error('[CircuitBreaker] Error loading state from database', error);
        }
    }

    /**
     * Save state for a specific backend to database
     */
    private saveState(backend: string): void {
        if (!this.db) return;

        const state = this.states.get(backend);
        if (!state) return;

        try {
            this.db.prepare(`
                INSERT OR REPLACE INTO circuit_breaker_state
                (backend, state, failures, last_failure_time)
                VALUES (?, ?, ?, ?)
            `).run(backend, state.state, state.failures, state.lastFailureTime || null);
        } catch (error) {
            logger.error(`[CircuitBreaker] Error saving state for ${backend}`, error);
        }
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
            this.saveState(backend); // Persist state change
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
            this.saveState(backend); // Persist state change
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
        this.saveState(backend); // Persist state transition
    }

    /**
     * Reset all states (for testing and development)
     */
    public reset(): void {
        this.states.clear();
        
        // Clear database state too
        if (this.db) {
            try {
                this.db.prepare('DELETE FROM circuit_breaker_state').run();
                logger.debug('[CircuitBreaker] Cleared database state');
            } catch (error) {
                logger.error('[CircuitBreaker] Error clearing database state', error);
            }
        }
        
        logger.info("[CircuitBreaker] All circuits reset");
    }

    /**
     * Shutdown - persist final state before closing
     */
    public shutdown(): void {
        if (!this.db) return;

        try {
            // Persist all current states
            for (const [backend, state] of this.states.entries()) {
                this.db.prepare(`
                    INSERT OR REPLACE INTO circuit_breaker_state
                    (backend, state, failures, last_failure_time)
                    VALUES (?, ?, ?, ?)
                `).run(backend, state.state, state.failures, state.lastFailureTime || null);
            }
            logger.debug('[CircuitBreaker] Persisted final state to database');
        } catch (error) {
            logger.error('[CircuitBreaker] Error persisting final state', error);
        }
    }

    /**
     * Get current state for all backends (for debugging)
     */
    public getStates(): Map<string, BackendState> {
        return new Map(this.states);
    }
}
