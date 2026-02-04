/**
 * Unit tests for MetricsRepository
 *
 * Observability: Tests RED metrics storage and retrieval
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetricsRepository } from '../../../src/repositories/metrics.js';
import { AsyncDatabase } from '../../../src/infrastructure/async-db.js';
import Database from 'better-sqlite3';

// Mock AsyncDatabase to use synchronous better-sqlite3 under the hood
// This avoids worker thread issues in Vitest
vi.mock('../../../src/infrastructure/async-db.js', () => {
  return {
    AsyncDatabase: vi.fn()
  };
});

interface RedMetricRow {
  id: string;
  timestamp: number;
  metric_type: string;
  component: string;
  backend: string | null;
  duration: number;
  success: number; // SQLite stores boolean as 0/1
  error_type: string | null;
  request_id: string | null;
  metadata: string; // JSON string
}

describe('MetricsRepository', () => {
  let db: Database.Database;
  let asyncDb: any;
  let repo: MetricsRepository;

  beforeEach(async () => {
    // Create fresh in-memory database
    db = new Database(':memory:');

    // Create mock object manually to ensure methods exist
    asyncDb = {
      execAsync: vi.fn(async (sql: string) => {
        db.exec(sql);
      }),
      runAsync: vi.fn(async (sql: string, params: any[] = []) => {
        db.prepare(sql).run(...params);
      }),
      allAsync: vi.fn(async (sql: string, params: any[] = []) => {
        return db.prepare(sql).all(...params);
      }),
      getAsync: vi.fn(async (sql: string, params: any[] = []) => {
        return db.prepare(sql).get(...params);
      }),
      closeAsync: vi.fn(async () => {
        // No-op for mock, we close db in afterEach
      })
    };

    // Instantiate repo with mocked asyncDb
    repo = new MetricsRepository(asyncDb as unknown as AsyncDatabase);
    await repo.initializeSchema();
  });

  afterEach(() => {
    db.close();
  });

  describe('record()', () => {
    it('should record a metric and return an ID', async () => {
      const id = await repo.record({
        metricType: 'request',
        component: 'test-component',
        duration: 100,
        success: true
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.startsWith('red-')).toBe(true);

      const rows = db.prepare('SELECT * FROM red_metrics').all();
      expect(rows).toHaveLength(1);
    });

    it('should record optional fields correctly', async () => {
      await repo.record({
        metricType: 'workflow',
        component: 'my-workflow',
        backend: 'gemini',
        duration: 500,
        success: false,
        errorType: 'TimeoutError',
        requestId: 'req-123',
        metadata: { attempts: 3 }
      });

      const row = db.prepare('SELECT * FROM red_metrics').get() as RedMetricRow;
      expect(row.metric_type).toBe('workflow');
      expect(row.backend).toBe('gemini');
      expect(row.error_type).toBe('TimeoutError');
      expect(row.request_id).toBe('req-123');
      expect(JSON.parse(row.metadata)).toEqual({ attempts: 3 });
    });
  });

  describe('query()', () => {
    beforeEach(() => {
      // Seed some data
      const now = Date.now();
      const insert = db.prepare(`
        INSERT INTO red_metrics (id, timestamp, metric_type, component, backend, duration, success, error_type, request_id, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run('1', now - 1000, 'request', 'comp-a', 'gemini', 100, 1, null, 'req-1', '{}');
      insert.run('2', now - 2000, 'request', 'comp-a', 'claude', 200, 0, 'RateLimit', 'req-2', '{}');
      insert.run('3', now - 3000, 'workflow', 'comp-b', null, 500, 1, null, 'req-3', '{}');
    });

    it('should filter by component', async () => {
      const results = await repo.query({ component: 'comp-a' });
      expect(results).toHaveLength(2);
      expect(results.map(r => r.id).sort()).toEqual(['1', '2']);
    });

    it('should filter by backend', async () => {
      const results = await repo.query({ backend: 'gemini' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('should filter by success', async () => {
      const results = await repo.query({ success: false });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });

    it('should filter by requestId', async () => {
      const results = await repo.query({ requestId: 'req-3' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('3');
    });

    it('should filter by multiple criteria (component AND success)', async () => {
      const results = await repo.query({
        component: 'comp-a',
        success: false
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2'); // Only comp-a with success=false
    });
  });

  describe('getREDStats()', () => {
    beforeEach(() => {
      // Seed data for stats
      // 5 requests: 4 success, 1 fail
      // Durations: 10, 20, 30, 40, 100 (fail)
      const now = Date.now();
      const insert = db.prepare(`
        INSERT INTO red_metrics (id, timestamp, metric_type, component, backend, duration, success, error_type, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run('1', now, 'request', 'api', null, 10, 1, null, '{}');
      insert.run('2', now, 'request', 'api', null, 20, 1, null, '{}');
      insert.run('3', now, 'request', 'api', null, 30, 1, null, '{}');
      insert.run('4', now, 'request', 'api', null, 40, 1, null, '{}');
      insert.run('5', now, 'request', 'api', null, 100, 0, 'Error', '{}');
    });

    it('should calculate correct stats', async () => {
      const stats = await repo.getREDStats({ component: 'api' });

      expect(stats.totalRequests).toBe(5);
      expect(stats.errorRate).toBe(20); // 1 out of 5
      expect(stats.p50).toBe(30); // Median of 10, 20, 30, 40, 100
      expect(stats.p95).toBe(100);
      expect(stats.p99).toBe(100);
    });

    it('should return zeros for empty metrics', async () => {
      const stats = await repo.getREDStats({ component: 'non-existent' });
      expect(stats.totalRequests).toBe(0);
      expect(stats.errorRate).toBe(0);
      expect(stats.p50).toBe(0);
    });
  });

  describe('getErrorBreakdown()', () => {
    beforeEach(() => {
      const now = Date.now();
      const insert = db.prepare(`
        INSERT INTO red_metrics (id, timestamp, metric_type, component, backend, duration, success, error_type, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run('1', now, 'request', 'api', null, 10, 0, 'Timeout', '{}');
      insert.run('2', now, 'request', 'api', null, 10, 0, 'Timeout', '{}');
      insert.run('3', now, 'request', 'api', null, 10, 0, 'AuthError', '{}');
      insert.run('4', now, 'request', 'api', null, 10, 1, null, '{}');
    });

    it('should return correct error breakdown', async () => {
      const breakdown = await repo.getErrorBreakdown({ component: 'api' });

      expect(breakdown).toHaveLength(2);
      // Timeout: 2, AuthError: 1
      const timeout = breakdown.find(b => b.errorType === 'Timeout');
      const auth = breakdown.find(b => b.errorType === 'AuthError');

      expect(timeout?.count).toBe(2);
      expect(auth?.count).toBe(1);
    });
  });
});
