/**
 * Base Repository Pattern
 *
 * Abstract class for data access layers using AsyncDatabase.
 */
import { AsyncDatabase } from '../lib/async-db.js';
export declare abstract class BaseRepository {
    protected db: AsyncDatabase;
    constructor(db: AsyncDatabase);
    /**
     * Initialize tables - to be overridden by subclasses
     */
    abstract initializeSchema(): Promise<void>;
}
//# sourceMappingURL=base.d.ts.map