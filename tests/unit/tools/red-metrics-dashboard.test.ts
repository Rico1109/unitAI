/**
 * Unit tests for red-metrics-dashboard tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { redMetricsDashboardTool } from '../../../src/tools/red-metrics-dashboard.tool.js';
import { MetricsRepository } from '../../../src/repositories/metrics.js';
import Database from 'better-sqlite3';

// Mock dependencies
const mockDb = new Database(':memory:');

vi.mock('../../../src/dependencies.js', () => ({
  getDependencies: () => ({
    metricsDb: mockDb
  })
}));

describe('red-metrics-dashboard tool', () => {
  let repo: MetricsRepository;

  beforeEach(() => {
    // Reset DB and repo
    repo = new MetricsRepository(mockDb);
    repo.initializeSchema();
    mockDb.prepare('DELETE FROM red_metrics').run();
  });

  afterEach(() => {
    // mockDb.close(); // Don't close, reuse across tests or recreate if possible. 
    // Since it's a module level const, closing it might break subsequent tests if parallel? 
    // Ideally we should create a fresh DB per test, but mocking imports is static.
    // We'll stick to clearing the table.
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
