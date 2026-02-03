/**
 * RED Metrics Repository - Rate, Errors, Duration tracking
 *
 * Tracks operational metrics for:
 * - AI backend calls (gemini, cursor, droid, etc.)
 * - Workflow operations
 * - Tool executions
 *
 * Provides RED metrics: Rate, Error rate, Duration (P50/P95/P99)
 */
import { AsyncDatabase } from '../infrastructure/async-db.js';
import { BaseRepository } from './base.js';

export interface REDMetric {
  id: string;
  timestamp: Date;
  metricType: 'request' | 'workflow';
  component: string;
  backend?: string;
  duration: number; // milliseconds
  success: boolean;
  errorType?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export class MetricsRepository extends BaseRepository {
  /**
   * Initialize RED metrics database schema
   */
  async initializeSchema(): Promise<void> {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS red_metrics (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        metric_type TEXT NOT NULL,
        component TEXT NOT NULL,
        backend TEXT,
        duration INTEGER NOT NULL,
        success INTEGER NOT NULL,
        error_type TEXT,
        request_id TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_red_timestamp ON red_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_red_component ON red_metrics(component);
      CREATE INDEX IF NOT EXISTS idx_red_backend ON red_metrics(backend);
      CREATE INDEX IF NOT EXISTS idx_red_success ON red_metrics(success);
      CREATE INDEX IF NOT EXISTS idx_red_request_id ON red_metrics(request_id);
    `);
  }

  /**
   * Record a RED metric
   */
  async record(metric: Omit<REDMetric, 'id' | 'timestamp'>): Promise<string> {
    const id = `red-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const timestamp = Date.now();

    const sql = `
      INSERT INTO red_metrics (
        id, timestamp, metric_type, component, backend,
        duration, success, error_type, request_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await this.db.runAsync(sql, [
      id,
      timestamp,
      metric.metricType,
      metric.component,
      metric.backend || null,
      metric.duration,
      metric.success ? 1 : 0,
      metric.errorType || null,
      metric.requestId || null,
      JSON.stringify(metric.metadata || {})
    ]);

    return id;
  }

  /**
   * Query metrics with filters
   */
  async query(filters: {
    component?: string;
    backend?: string;
    startTime?: Date;
    endTime?: Date;
    success?: boolean;
    requestId?: string;
    limit?: number;
  }): Promise<REDMetric[]> {
    let sql = 'SELECT * FROM red_metrics WHERE 1=1';
    const params: any[] = [];

    if (filters.component) {
      sql += ' AND component = ?';
      params.push(filters.component);
    }

    if (filters.backend) {
      sql += ' AND backend = ?';
      params.push(filters.backend);
    }

    if (filters.startTime) {
      sql += ' AND timestamp >= ?';
      params.push(filters.startTime.getTime());
    }

    if (filters.endTime) {
      sql += ' AND timestamp <= ?';
      params.push(filters.endTime.getTime());
    }

    if (filters.success !== undefined) {
      sql += ' AND success = ?';
      params.push(filters.success ? 1 : 0);
    }

    if (filters.requestId) {
      sql += ' AND request_id = ?';
      params.push(filters.requestId);
    }

    sql += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = await this.db.allAsync<any>(sql, params);

    return rows.map(row => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      metricType: row.metric_type as 'request' | 'workflow',
      component: row.component,
      backend: row.backend,
      duration: row.duration,
      success: row.success === 1,
      errorType: row.error_type,
      requestId: row.request_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Calculate RED statistics
   */
  async getREDStats(filters: {
    component?: string;
    backend?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<{
    rate: number;
    errorRate: number;
    p50: number;
    p95: number;
    p99: number;
    totalRequests: number;
  }> {
    const metrics = await this.query(filters);

    if (metrics.length === 0) {
      return {
        rate: 0,
        errorRate: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        totalRequests: 0
      };
    }

    // Calculate rate (requests per second)
    const timeRangeMs = filters.endTime && filters.startTime
      ? filters.endTime.getTime() - filters.startTime.getTime()
      : 60000; // Default: 1 minute
    const rate = (metrics.length / timeRangeMs) * 1000;

    // Calculate error rate
    const successfulRequests = metrics.filter(m => m.success).length;
    const errorRate = ((metrics.length - successfulRequests) / metrics.length) * 100;

    // Calculate duration percentiles
    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);
    const p99 = percentile(durations, 99);

    return {
      rate,
      errorRate,
      p50,
      p95,
      p99,
      totalRequests: metrics.length
    };
  }

  /**
   * Get error breakdown
   */
  async getErrorBreakdown(filters: {
    component?: string;
    backend?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<Array<{ errorType: string; count: number }>> {
    let sql = `
      SELECT error_type, COUNT(*) as count
      FROM red_metrics
      WHERE success = 0 AND error_type IS NOT NULL
    `;
    const params: any[] = [];

    if (filters.component) {
      sql += ' AND component = ?';
      params.push(filters.component);
    }

    if (filters.backend) {
      sql += ' AND backend = ?';
      params.push(filters.backend);
    }

    if (filters.startTime) {
      sql += ' AND timestamp >= ?';
      params.push(filters.startTime.getTime());
    }

    if (filters.endTime) {
      sql += ' AND timestamp <= ?';
      params.push(filters.endTime.getTime());
    }

    sql += ' GROUP BY error_type ORDER BY count DESC';

    const rows = await this.db.allAsync<any>(sql, params);

    return rows.map(row => ({
      errorType: row.error_type,
      count: row.count
    }));
  }
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}
