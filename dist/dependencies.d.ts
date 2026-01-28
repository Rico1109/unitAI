/**
 * Dependency Injection Container
 *
 * Manages the lifecycle and injection of services, repositories, and databases.
 */
import Database from 'better-sqlite3';
import { CircuitBreaker } from './utils/circuitBreaker.js';
export interface AppDependencies {
    activityDb: Database.Database;
    auditDb: Database.Database;
    tokenDb: Database.Database;
    metricsDb: Database.Database;
    circuitBreaker: CircuitBreaker;
}
/**
 * Initialize all system dependencies
 */
export declare function initializeDependencies(): AppDependencies;
/**
 * Get the singleton dependencies instance
 */
export declare function getDependencies(): AppDependencies;
/**
 * Cleanup dependencies (close DBs, etc)
 */
export declare function closeDependencies(): void;
//# sourceMappingURL=dependencies.d.ts.map