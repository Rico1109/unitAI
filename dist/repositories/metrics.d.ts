import { BaseRepository } from './base.js';
export interface REDMetric {
    id: string;
    timestamp: Date;
    metricType: 'request' | 'workflow';
    component: string;
    backend?: string;
    duration: number;
    success: boolean;
    errorType?: string;
    requestId?: string;
    metadata?: Record<string, any>;
}
export declare class MetricsRepository extends BaseRepository {
    /**
     * Initialize RED metrics database schema
     */
    initializeSchema(): Promise<void>;
    /**
     * Record a RED metric
     */
    record(metric: Omit<REDMetric, 'id' | 'timestamp'>): Promise<string>;
    /**
     * Query metrics with filters
     */
    query(filters: {
        component?: string;
        backend?: string;
        startTime?: Date;
        endTime?: Date;
        success?: boolean;
        requestId?: string;
        limit?: number;
    }): Promise<REDMetric[]>;
    /**
     * Calculate RED statistics
     */
    getREDStats(filters: {
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
    }>;
    /**
     * Get error breakdown
     */
    getErrorBreakdown(filters: {
        component?: string;
        backend?: string;
        startTime?: Date;
        endTime?: Date;
    }): Promise<Array<{
        errorType: string;
        count: number;
    }>>;
}
//# sourceMappingURL=metrics.d.ts.map