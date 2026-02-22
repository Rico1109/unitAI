/**
 * Unit tests for red-metrics-dashboard tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { redMetricsDashboardTool } from '../../../src/tools/red-metrics-dashboard.tool.js';
import { MetricsRepository } from '../../../src/repositories/metrics.js';
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

  // Direct access to underlying DB for cleanup
  get _db() {
    return this.db;
  }
}

// Mock dependencies
const mockDb = new MockAsyncDatabase(':memory:') as any;

vi.mock('../../../src/dependencies.js', () => ({
  getDependencies: () => ({
    metricsDb: mockDb
  })
}));

describe('red-metrics-dashboard tool', () => {
  let repo: MetricsRepository;

  beforeEach(async () => {
    // Reset DB and repo
    repo = new MetricsRepository(mockDb);
    await repo.initializeSchema();
    mockDb._db.prepare('DELETE FROM red_metrics').run();
  });

  afterEach(() => {
    // Clear data between tests (DB is reused as module-level mock)
    mockDb._db.prepare('DELETE FROM red_metrics').run();
  });

  it('should return empty message when no metrics exist', async () => {
    const result = await redMetricsDashboardTool.execute(
      { timeRangeMinutes: 60 },
      { requestId: 'test-req' }
    );

    expect(result).toContain('No metrics found');
    expect(result).toContain('[requestId: test-req]');
  });

  it('should display correct stats when metrics exist', async () => {
    // Seed data
    repo.record({
      metricType: 'request',
      component: 'test-comp',
      duration: 100,
      success: true
    });
    repo.record({
      metricType: 'request',
      component: 'test-comp',
      duration: 200,
      success: false,
      errorType: 'TestError'
    });

    const result = await redMetricsDashboardTool.execute(
      { timeRangeMinutes: 60 },
      { requestId: 'test-req' }
    );

    expect(result).toContain('Total requests: 2');
    expect(result).toContain('Error rate: 50.00%');
    expect(result).toContain('TestError: 1 occurrences');
    expect(result).not.toContain('No metrics found');
  });

  it('should filter by component', async () => {
    repo.record({ metricType: 'request', component: 'A', duration: 10, success: true });
    repo.record({ metricType: 'request', component: 'B', duration: 10, success: true });

    const result = await redMetricsDashboardTool.execute(
      { component: 'A', timeRangeMinutes: 60 },
      { requestId: 'req' }
    );

    expect(result).toContain('Component: A');
    expect(result).toContain('Total requests: 1');
  });
});
