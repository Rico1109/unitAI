/**
 * Base Repository Pattern
 *
 * Abstract class for data access layers using AsyncDatabase.
 */
import { AsyncDatabase } from '../infrastructure/async-db.js';

export abstract class BaseRepository {
    protected db: AsyncDatabase;

    constructor(db: AsyncDatabase) {
        this.db = db;
    }

    /**
     * Initialize tables - to be overridden by subclasses
     */
    abstract initializeSchema(): Promise<void>;

    /**
     * Note: True async transactions are complex with worker_threads.
     * This is a placeholder; real implementation would require careful worker-side logic.
     */
    // protected transaction<T>(fn: () => T): T {
    //     return this.db.transaction(fn)();
    // }
}
