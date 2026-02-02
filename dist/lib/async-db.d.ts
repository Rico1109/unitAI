/**
 * Async Database Wrapper using Worker Threads
 *
 * Wraps better-sqlite3 in worker threads to provide async/await interface
 * while maintaining the performance benefits of better-sqlite3.
 */
import Database from 'better-sqlite3';
export declare class AsyncDatabase {
    private worker;
    private correlationId;
    private openRequests;
    constructor(dbPath: string);
    private sendRequest;
    execAsync(sql: string): Promise<void>;
    runAsync(sql: string, params?: any[]): Promise<Database.RunResult>;
    getAsync<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
    allAsync<T = any>(sql: string, params?: any[]): Promise<T[]>;
    closeAsync(): Promise<void>;
}
//# sourceMappingURL=async-db.d.ts.map