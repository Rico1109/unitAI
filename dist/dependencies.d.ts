/**
 * Dependency Injection Container
 *
 * Manages the lifecycle and injection of services, repositories, and databases.
 */
import Database from 'better-sqlite3';
import { AsyncDatabase } from './lib/async-db.js';
import { CircuitBreaker } from './utils/reliability/circuitBreaker.js';
export interface AppDependencies {
    activityDb: AsyncDatabase;
    auditDb: AsyncDatabase;
    tokenDb: AsyncDatabase;
    metricsDb: AsyncDatabase;
    circuitBreaker: CircuitBreaker;
    auditDbSync: Database.Database;
}
/**
 * Initialize all system dependencies
 */
export declare function initializeDependencies(): Promise<AppDependencies>;
/**
 * Get the singleton dependencies instance
 */
export declare function getDependencies(): AppDependencies;
/**
 * Cleanup dependencies (close DBs, etc)
 */
export declare function closeDependencies(): Promise<void>;
//# sourceMappingURL=dependencies.d.ts.map