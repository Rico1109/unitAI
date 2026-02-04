/**
 * Test Dependencies Helper
 *
 * Provides in-memory database instances for testing
 */

import Database from 'better-sqlite3';

/**
 * Mock AsyncDatabase for testing
 * Wraps better-sqlite3 to provide same interface as AsyncDatabase
 */
class MockAsyncDatabase {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, params: any[] = []): Promise<Database.RunResult> {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  async getAsync(sql: string, params: any[] = []): Promise<any> {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  async allAsync(sql: string, params: any[] = []): Promise<any[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

export function createTestDependencies() {
  return {
    activityDb: new MockAsyncDatabase(':memory:') as any,
    auditDb: new MockAsyncDatabase(':memory:') as any,
    tokenDb: new MockAsyncDatabase(':memory:') as any
  };
}
