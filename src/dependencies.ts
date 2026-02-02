/**
 * Dependency Injection Container
 *
 * Manages the lifecycle and injection of services, repositories, and databases.
 */
import Database from 'better-sqlite3'; // Keep for sync needs (CircuitBreaker)
import path from 'path';
import fs from 'fs';
import { AsyncDatabase } from './lib/async-db.js';
import { logger } from './utils/logger.js';
import { CircuitBreaker } from './utils/reliability/circuitBreaker.js';
import { ActivityRepository } from './repositories/activity.js';
import { MetricsRepository } from './repositories/metrics.js';

// Define the shape of our dependencies
export interface AppDependencies {
    activityDb: AsyncDatabase;
    auditDb: AsyncDatabase;
    tokenDb: AsyncDatabase;
    metricsDb: AsyncDatabase;
    circuitBreaker: CircuitBreaker;
    // Keep a sync instance for legacy/difficult-to-refactor components
    auditDbSync: Database.Database;
    tokenDbSync: Database.Database;
    // Add other shared DBs or services here as we migrate them
}

let dependencies: AppDependencies | null = null;

/**
 * Initialize all system dependencies
 */
export async function initializeDependencies(): Promise<AppDependencies> {
    if (dependencies) {
        return dependencies;
    }

    logger.info("Initializing dependencies...");

    // Setup Data Directory
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // --- Initialize Databases ---
    // We create both sync and async versions where needed for gradual migration.

    // Initialize Activity Database
    const activityDbPath = path.join(dataDir, 'activity.sqlite');
    logger.debug(`Opening Activity DB at ${activityDbPath}`);
    const activityDb = new AsyncDatabase(activityDbPath);
    await activityDb.execAsync('PRAGMA journal_mode = WAL;');

    // Initialize Audit Database
    const auditDbPath = path.join(dataDir, 'audit.sqlite');
    logger.debug(`Opening Audit DB at ${auditDbPath}`);
    const auditDb = new AsyncDatabase(auditDbPath);
    await auditDb.execAsync('PRAGMA journal_mode = WAL;');
    // Sync version for CircuitBreaker
    const auditDbSync = new Database(auditDbPath);
    auditDbSync.pragma('journal_mode = WAL');

    // Initialize Token Metrics Database
    const tokenDbPath = path.join(dataDir, 'token-metrics.sqlite');
    logger.debug(`Opening Token Metrics DB at ${tokenDbPath}`);
    const tokenDb = new AsyncDatabase(tokenDbPath);
    await tokenDb.execAsync('PRAGMA journal_mode = WAL;');
    // Sync version for TokenSavingsMetrics
    const tokenDbSync = new Database(tokenDbPath);
    tokenDbSync.pragma('journal_mode = WAL');

    // Initialize RED Metrics Database
    const metricsDbPath = path.join(dataDir, 'red-metrics.sqlite');
    logger.debug(`Opening RED Metrics DB at ${metricsDbPath}`);
    const metricsDb = new AsyncDatabase(metricsDbPath);
    await metricsDb.execAsync('PRAGMA journal_mode = WAL;');

    // --- Initialize Repositories and Services ---

    // Initialize activity repository and schema
    const activityRepo = new ActivityRepository(activityDb);
    await activityRepo.initializeSchema();

    // Initialize metrics repository and schema
    const metricsRepo = new MetricsRepository(metricsDb);
    await metricsRepo.initializeSchema();

    // Initialize Circuit Breaker with audit database for state persistence
    logger.debug("Initializing Circuit Breaker");
    const circuitBreaker = new CircuitBreaker(3, 5 * 60 * 1000, auditDbSync);

    dependencies = {
        activityDb,
        auditDb,
        tokenDb,
        metricsDb,
        circuitBreaker,
        auditDbSync,
        tokenDbSync
    };

    return dependencies;
}

/**
 * Get the singleton dependencies instance
 */
export function getDependencies(): AppDependencies {
    if (!dependencies) {
        throw new Error("Dependencies not initialized. Call initializeDependencies() first.");
    }
    return dependencies;
}

/**
 * Cleanup dependencies (close DBs, etc)
 */
export async function closeDependencies(): Promise<void> {
    if (dependencies) {
        logger.info("Closing dependencies...");

        // Persist circuit breaker state before closing
        try {
            dependencies.circuitBreaker.shutdown();
        } catch (error) {
            logger.error("Error persisting circuit breaker state during shutdown", error);
        }

        // Close the synchronous DB connection
        if (dependencies.auditDbSync) {
            try {
                dependencies.auditDbSync.close();
            } catch (error) {
                logger.error("Error closing audit database sync connection", error);
            }
        }
        if (dependencies.tokenDbSync) {
            try {
                dependencies.tokenDbSync.close();
            } catch (error) {
                logger.error("Error closing token database sync connection", error);
            }
        }

        // Close all async databases
        await Promise.all([
            dependencies.activityDb.closeAsync(),
            dependencies.auditDb.closeAsync(),
            dependencies.tokenDb.closeAsync(),
            dependencies.metricsDb.closeAsync()
        ]).catch(error => {
            logger.error("Error closing one or more async databases", error);
        });

        dependencies = null;
    }
}
