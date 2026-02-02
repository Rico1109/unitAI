/**
 * Circuit Breaker for AI Backends
 *
 * Implements a state machine to track backend health and prevent cascading failures.
 * States:
 * - CLOSED: Normal operation, requests allowed.
 * - OPEN: Backend failed too many times, requests blocked.
 * - HALF_OPEN: Testing backend recovery, limited requests allowed.
 */
import { logger } from "../logger.js";
export var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (CircuitState = {}));
export class CircuitBreaker {
    states = new Map();
    db = null;
    stateMutex = Promise.resolve();
    testingHalfOpen = false;
    config = {
        failureThreshold: 3,
        resetTimeoutMs: 5 * 60 * 1000 // 5 minutes
    };
    /**
     * Execute a function with exclusive state lock
     * Prevents race conditions in state transitions
     */
    async withStateLock(fn) {
        const prev = this.stateMutex;
        let release;
        this.stateMutex = new Promise(r => release = r);
        await prev;
        try {
            return await fn();
        }
        finally {
            release();
        }
    }
    constructor(failureThreshold = 3, resetTimeoutMs = 5 * 60 * 1000, db) {
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
    initializeTable() {
        if (!this.db)
            return;
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
    loadState() {
        if (!this.db)
            return;
        try {
            const rows = this.db.prepare('SELECT * FROM circuit_breaker_state').all();
            for (const row of rows) {
                this.states.set(row.backend, {
                    state: row.state,
                    failures: row.failures,
                    lastFailureTime: row.last_failure_time || 0
                });
            }
            logger.debug(`[CircuitBreaker] Loaded ${rows.length} backend states from database`);
        }
        catch (error) {
            logger.error('[CircuitBreaker] Error loading state from database', error);
        }
    }
    /**
     * Save state for a specific backend to database
     */
    saveState(backend) {
        if (!this.db)
            return;
        const state = this.states.get(backend);
        if (!state)
            return;
        try {
            this.db.prepare(`
                INSERT OR REPLACE INTO circuit_breaker_state
                (backend, state, failures, last_failure_time)
                VALUES (?, ?, ?, ?)
            `).run(backend, state.state, state.failures, state.lastFailureTime || null);
        }
        catch (error) {
            logger.error(`[CircuitBreaker] Error saving state for ${backend}`, error);
        }
    }
    /**
     * Check if a backend is available
     */
    async isAvailable(backend) {
        return this.withStateLock(async () => {
            const state = this.getState(backend);
            if (state.state === CircuitState.HALF_OPEN) {
                // Only allow one test request
                if (this.testingHalfOpen) {
                    return false; // Other requests must wait
                }
                this.testingHalfOpen = true;
                return true;
            }
            if (state.state === CircuitState.OPEN) {
                const now = Date.now();
                if (now - state.lastFailureTime > this.config.resetTimeoutMs) {
                    await this.transitionTo(backend, CircuitState.HALF_OPEN);
                    this.testingHalfOpen = true; // This is the first test request
                    return true; // Allow one trial request
                }
                return false;
            }
            return true;
        });
    }
    /**
     * Record a successful execution
     */
    async onSuccess(backend) {
        await this.withStateLock(async () => {
            const state = this.getState(backend);
            if (state.state === CircuitState.HALF_OPEN) {
                this.testingHalfOpen = false; // Reset flag
                await this.transitionTo(backend, CircuitState.CLOSED);
                logger.info(`[CircuitBreaker] Backend ${backend} recovered. Circuit CLOSED.`);
            }
            else if (state.failures > 0) {
                // Reset failures on success in CLOSED state
                state.failures = 0;
                this.states.set(backend, state);
                this.saveState(backend); // Persist state change
            }
        });
    }
    /**
     * Record a failed execution
     */
    async onFailure(backend) {
        await this.withStateLock(async () => {
            const state = this.getState(backend);
            state.failures++;
            state.lastFailureTime = Date.now();
            if (state.state === CircuitState.HALF_OPEN) {
                this.testingHalfOpen = false; // Reset flag
                await this.transitionTo(backend, CircuitState.OPEN);
                logger.warn(`[CircuitBreaker] Backend ${backend} failed recovery check. Circuit OPEN.`);
            }
            else if (state.state === CircuitState.CLOSED && state.failures >= this.config.failureThreshold) {
                await this.transitionTo(backend, CircuitState.OPEN);
                logger.error(`[CircuitBreaker] Backend ${backend} reached failure threshold. Circuit OPEN.`);
            }
            else {
                this.states.set(backend, state);
                this.saveState(backend); // Persist state change
            }
        });
    }
    /**
     * Get current state for a backend
     */
    getState(backend) {
        if (!this.states.has(backend)) {
            this.states.set(backend, {
                state: CircuitState.CLOSED,
                failures: 0,
                lastFailureTime: 0
            });
        }
        return this.states.get(backend);
    }
    /**
     * Transition backend to a new state
     */
    async transitionTo(backend, newState) {
        await this.withStateLock(() => {
            const state = this.getState(backend);
            state.state = newState;
            if (newState === CircuitState.CLOSED) {
                state.failures = 0;
            }
            this.states.set(backend, state);
            this.saveState(backend); // Persist state transition
        });
    }
    /**
     * Reset all states (for testing and development)
     */
    reset() {
        this.states.clear();
        // Clear database state too
        if (this.db) {
            try {
                this.db.prepare('DELETE FROM circuit_breaker_state').run();
                logger.debug('[CircuitBreaker] Cleared database state');
            }
            catch (error) {
                logger.error('[CircuitBreaker] Error clearing database state', error);
            }
        }
        logger.info("[CircuitBreaker] All circuits reset");
    }
    /**
     * Shutdown - persist final state before closing
     */
    shutdown() {
        if (!this.db)
            return;
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
        }
        catch (error) {
            logger.error('[CircuitBreaker] Error persisting final state', error);
        }
    }
    /**
     * Get current state for all backends (for debugging)
     */
    getStates() {
        return new Map(this.states);
    }
}
//# sourceMappingURL=circuitBreaker.js.map