/**
 * Dependency Injection Container
 *
 * Manages the lifecycle and injection of services, repositories, and databases.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from './utils/logger.js';
import { CircuitBreaker } from './utils/circuitBreaker.js';
import { MetricsRepository } from './repositories/metrics.js';
let dependencies = null;
/**
 * Initialize all system dependencies
 */
export function initializeDependencies() {
    if (dependencies) {
        return dependencies;
    }
    logger.info("Initializing dependencies...");
    // Setup Data Directory
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    // Initialize Activity Database
    const activityDbPath = path.join(dataDir, 'activity.sqlite');
    logger.debug(`Opening Activity DB at ${activityDbPath}`);
    const activityDb = new Database(activityDbPath);
    activityDb.pragma('journal_mode = WAL');
    // Initialize Audit Database
    const auditDbPath = path.join(dataDir, 'audit.sqlite');
    logger.debug(`Opening Audit DB at ${auditDbPath}`);
    const auditDb = new Database(auditDbPath);
    auditDb.pragma('journal_mode = WAL');
    // Initialize Token Metrics Database
    const tokenDbPath = path.join(dataDir, 'token-metrics.sqlite');
    logger.debug(`Opening Token Metrics DB at ${tokenDbPath}`);
    const tokenDb = new Database(tokenDbPath);
    tokenDb.pragma('journal_mode = WAL');
    // Initialize RED Metrics Database
    const metricsDbPath = path.join(dataDir, 'red-metrics.sqlite');
    logger.debug(`Opening RED Metrics DB at ${metricsDbPath}`);
    const metricsDb = new Database(metricsDbPath);
    metricsDb.pragma('journal_mode = WAL');
    // Initialize metrics repository and schema
    const metricsRepo = new MetricsRepository(metricsDb);
    metricsRepo.initializeSchema();
    // Initialize Circuit Breaker with audit database for state persistence
    logger.debug("Initializing Circuit Breaker");
    const circuitBreaker = new CircuitBreaker(3, 5 * 60 * 1000, auditDb);
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
export function getDependencies() {
    if (!dependencies) {
        throw new Error("Dependencies not initialized. Call initializeDependencies() first.");
    }
    return dependencies;
}
/**
 * Cleanup dependencies (close DBs, etc)
 */
export function closeDependencies() {
    if (dependencies) {
        logger.info("Closing dependencies...");
        // Persist circuit breaker state before closing
        try {
            dependencies.circuitBreaker.shutdown();
        }
        catch (error) {
            logger.error("Error persisting circuit breaker state during shutdown", error);
        }
        // Close databases with individual error handling
        try {
            dependencies.activityDb.close();
        }
        catch (error) {
            logger.error("Error closing activity database", error);
        }
        try {
            dependencies.auditDb.close();
        }
        catch (error) {
            logger.error("Error closing audit database", error);
        }
        try {
            dependencies.tokenDb.close();
        }
        catch (error) {
            logger.error("Error closing token database", error);
        }
        try {
            dependencies.metricsDb.close();
        }
        catch (error) {
            logger.error("Error closing metrics database", error);
        }
        dependencies = null;
    }
}
//# sourceMappingURL=dependencies.js.map