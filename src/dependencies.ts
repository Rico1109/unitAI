/**
 * Dependency Injection Container
 *
 * Manages the lifecycle and injection of services, repositories, and databases.
 */
import path from 'path';
import fs from 'fs';
import { AsyncDatabase } from './infrastructure/async-db.js';
import { logger } from './utils/logger.js';
import { CircuitBreakerRegistry } from './utils/reliability/errorRecovery.js';
import { ActivityRepository } from './repositories/activity.js';
import { MetricsRepository } from './repositories/metrics.js';

// Define the shape of our dependencies
export interface AppDependencies {
    activityDb: AsyncDatabase;
    auditDb: AsyncDatabase;
    tokenDb: AsyncDatabase;
    metricsDb: AsyncDatabase;
    circuitBreaker: CircuitBreakerRegistry;
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

    // --- Initialize Databases with rollback on partial failure ---
    // We open databases sequentially and track each one so that if a later
    // open fails, any already-opened handles are closed before rethrowing.
    const openedDbs: AsyncDatabase[] = [];

    const openDb = async (dbPath: string): Promise<AsyncDatabase> => {
        const db = new AsyncDatabase(dbPath);
        await db.execAsync('PRAGMA journal_mode = WAL;');
        openedDbs.push(db);
        return db;
    };

    let activityDb: AsyncDatabase;
    let auditDb: AsyncDatabase;
    let tokenDb: AsyncDatabase;
    let metricsDb: AsyncDatabase;

    try {
        const activityDbPath = path.join(dataDir, 'activity.sqlite');
        logger.debug(`Opening Activity DB at ${activityDbPath}`);
        activityDb = await openDb(activityDbPath);

        const auditDbPath = path.join(dataDir, 'audit.sqlite');
        logger.debug(`Opening Audit DB at ${auditDbPath}`);
        auditDb = await openDb(auditDbPath);

        const tokenDbPath = path.join(dataDir, 'token-metrics.sqlite');
        logger.debug(`Opening Token Metrics DB at ${tokenDbPath}`);
        tokenDb = await openDb(tokenDbPath);

        const metricsDbPath = path.join(dataDir, 'red-metrics.sqlite');
        logger.debug(`Opening RED Metrics DB at ${metricsDbPath}`);
        metricsDb = await openDb(metricsDbPath);
    } catch (error) {
        // Close any databases that were successfully opened before the failure
        await Promise.all(openedDbs.map(db => db.closeAsync().catch(() => {})));
        throw error;
    }

    // --- Initialize Repositories and Services ---

    // Initialize activity repository and schema
    const activityRepo = new ActivityRepository(activityDb);
    await activityRepo.initializeSchema();

    // Initialize metrics repository and schema
    const metricsRepo = new MetricsRepository(metricsDb);
    await metricsRepo.initializeSchema();

    // Initialize per-backend Circuit Breaker Registry (in-memory)
    // Each backend gets its own independent circuit breaker so one failure
    // does not cascade and block all other backends.
    logger.debug("Initializing Circuit Breaker Registry");
    const circuitBreaker = new CircuitBreakerRegistry();

    dependencies = {
        activityDb,
        auditDb,
        tokenDb,
        metricsDb,
        circuitBreaker
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
            // Shutdown all per-backend circuit breakers (no-op for in-memory)
        for (const breaker of Object.values(dependencies.circuitBreaker.getAllStats())) {
            void breaker; // breakers are stateless in-memory, nothing to flush
        }
        } catch (error) {
            logger.error("Error persisting circuit breaker state during shutdown", error);
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
