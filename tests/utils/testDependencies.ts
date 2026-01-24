/**
 * Test Dependencies Helper
 *
 * Provides in-memory database instances for testing
 */

import Database from 'better-sqlite3';

export function createTestDependencies() {
  return {
    activityDb: new Database(':memory:'),
    auditDb: new Database(':memory:'),
    tokenDb: new Database(':memory:')
  };
}
