/**
 * Dependency Injection Container
 * 
 * Manages the lifecycle and injection of services, repositories, and databases.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from './utils/logger.js';

// Define the shape of our dependencies
export interface AppDependencies {
    activityDb: Database.Database;
    auditDb: Database.Database;
    tokenDb: Database.Database;
    // Add other shared DBs or services here as we migrate them
}

let dependencies: AppDependencies | null = null;

/**
 * Initialize all system dependencies
 */
export function initializeDependencies(): AppDependencies {
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

    dependencies = {
        activityDb,
        auditDb,
        tokenDb
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
export function closeDependencies(): void {
    if (dependencies) {
        logger.info("Closing dependencies...");
        dependencies.activityDb.close();
        dependencies.auditDb.close();
        dependencies.tokenDb.close();
        dependencies = null;
    }
}
