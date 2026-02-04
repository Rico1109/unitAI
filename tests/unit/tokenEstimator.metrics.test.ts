
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TokenSavingsMetrics, getMetricsCollector } from '../../src/services/token-estimator.js';

// Mock AsyncDatabase
const mockExecAsync = vi.fn();
const mockRunAsync = vi.fn();
const mockAllAsync = vi.fn();
const mockGetAsync = vi.fn();
const mockCloseAsync = vi.fn();

vi.mock('../../src/infrastructure/async-db.js', () => {
  return {
    AsyncDatabase: vi.fn().mockImplementation(() => ({
      execAsync: mockExecAsync,
      runAsync: mockRunAsync,
      allAsync: mockAllAsync,
      getAsync: mockGetAsync,
      closeAsync: mockCloseAsync
    }))
  };
});

// Mock dependencies
vi.mock('../../src/dependencies.js', () => {
  const mockDb = {
    execAsync: async () => {},
    runAsync: async () => ({ changes: 1, lastInsertRowid: 1 }),
    allAsync: async () => [],
    getAsync: async () => null,
    closeAsync: async () => {}
  };

  return {
    getDependencies: () => ({
      tokenDb: mockDb
    })
  };
});

describe('TokenSavingsMetrics', () => {
  let metrics: TokenSavingsMetrics;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default mock implementations
    mockExecAsync.mockResolvedValue(undefined);
    mockRunAsync.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });
    mockAllAsync.mockResolvedValue([]);
    mockGetAsync.mockResolvedValue(null);
    mockCloseAsync.mockResolvedValue(undefined);

    const { AsyncDatabase } = await import('../../src/infrastructure/async-db.js');
    const db = new AsyncDatabase(':memory:');
    metrics = new TokenSavingsMetrics(db as any);
    await metrics.initializeSchema();
  });

  describe('record', () => {
    it('should record a token savings metric', async () => {
      const metricId = await metrics.record({
        source: 'enforcer-hook',
        blockedTool: 'Read',
        recommendedTool: 'serena',
        target: 'src/services/token-estimator.ts',
        estimatedSavings: 120,
        suggestionFollowed: false,
        metadata: { fileType: 'code' }
      });

      expect(metricId).toMatch(/^metric_/);
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO token_savings_metrics'),
        expect.arrayContaining(['enforcer-hook', 'Read', 'serena'])
      );
    });

    it('should store metric with all fields', async () => {
      await metrics.record({
        source: 'enforcer-hook',
        blockedTool: 'Grep',
        recommendedTool: 'claude-context',
        target: 'search pattern',
        estimatedSavings: 1500,
        actualTokensAvoided: 1450,
        suggestionFollowed: true,
        metadata: { pattern: 'test' }
      });

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining([
          'enforcer-hook',
          'Grep',
          'claude-context',
          'search pattern',
          1500,
          1450,
          1
        ])
      );
    });
  });

  describe('query', () => {
    const mockMetrics = [
      {
        id: '1',
        timestamp: Date.now(),
        source: 'enforcer-hook',
        blocked_tool: 'Read',
        recommended_tool: 'serena',
        target: 'file1.ts',
        estimated_savings: 100,
        actual_tokens_avoided: null,
        suggestion_followed: 1,
        metadata: '{}'
      },
      {
        id: '2',
        timestamp: Date.now(),
        source: 'workflow',
        blocked_tool: 'Bash',
        recommended_tool: 'serena',
        target: 'file2.ts',
        estimated_savings: 200,
        actual_tokens_avoided: null,
        suggestion_followed: 0,
        metadata: '{}'
      },
      {
        id: '3',
        timestamp: Date.now(),
        source: 'enforcer-hook',
        blocked_tool: 'Grep',
        recommended_tool: 'claude-context',
        target: 'pattern',
        estimated_savings: 1500,
        actual_tokens_avoided: null,
        suggestion_followed: 1,
        metadata: '{}'
      }
    ];

    beforeEach(() => {
      // Mock allAsync to return our test data
      mockAllAsync.mockResolvedValue(mockMetrics);
    });

    it('should query all metrics without filters', async () => {
      const results = await metrics.query();
      expect(results).toHaveLength(3);
      expect(mockAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM token_savings_metrics'),
        expect.any(Array)
      );
    });

    it('should filter by source', async () => {
      await metrics.query({ source: 'enforcer-hook' });
      expect(mockAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('source = ?'),
        expect.arrayContaining(['enforcer-hook'])
      );
    });

    it('should filter by blocked tool', async () => {
      await metrics.query({ blockedTool: 'Read' });
      expect(mockAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('blocked_tool = ?'),
        expect.arrayContaining(['Read'])
      );
    });

    it('should filter by suggestion followed', async () => {
      await metrics.query({ suggestionFollowed: true });
      expect(mockAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('suggestion_followed = ?'),
        expect.arrayContaining([1])
      );
    });

    it('should limit results', async () => {
      await metrics.query({ limit: 2 });
      expect(mockAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        expect.arrayContaining([2])
      );
    });
  });

  describe('getStats', () => {
    const mockMetrics = [
      {
        id: '1',
        timestamp: Date.now(),
        source: 'enforcer-hook',
        blocked_tool: 'Read',
        recommended_tool: 'serena',
        target: 'file1.ts',
        estimated_savings: 100,
        actual_tokens_avoided: 95,
        suggestion_followed: 1,
        metadata: '{}'
      },
      {
        id: '2',
        timestamp: Date.now(),
        source: 'enforcer-hook',
        blocked_tool: 'Read',
        recommended_tool: 'serena',
        target: 'file2.ts',
        estimated_savings: 150,
        actual_tokens_avoided: null,
        suggestion_followed: 0,
        metadata: '{}'
      },
      {
        id: '3',
        timestamp: Date.now(),
        source: 'workflow',
        blocked_tool: 'Grep',
        recommended_tool: 'claude-context',
        target: 'pattern',
        estimated_savings: 1500,
        actual_tokens_avoided: 1400,
        suggestion_followed: 1,
        metadata: '{}'
      }
    ];

    beforeEach(() => {
      mockAllAsync.mockResolvedValue(mockMetrics);
    });

    it('should calculate overall statistics', async () => {
      const stats = await metrics.getStats();

      expect(stats.totalSuggestions).toBe(3);
      expect(stats.suggestionsFollowed).toBe(2);
      expect(stats.suggestionsIgnored).toBe(1);
      expect(stats.totalEstimatedSavings).toBe(1750);
      expect(stats.totalActualSavings).toBe(1495); // 95 + 1400
      expect(stats.followRate).toBe(67); // 2/3 = 66.67% rounded to 67
    });

    it('should group by blocked tool', async () => {
      const stats = await metrics.getStats();

      expect(stats.byBlockedTool['Read']).toEqual({
        count: 2,
        savings: 250
      });
      expect(stats.byBlockedTool['Grep']).toEqual({
        count: 1,
        savings: 1500
      });
    });

    it('should group by recommended tool', async () => {
      const stats = await metrics.getStats();

      expect(stats.byRecommendedTool['serena']).toEqual({
        count: 2,
        savings: 250
      });
      expect(stats.byRecommendedTool['claude-context']).toEqual({
        count: 1,
        savings: 1500
      });
    });

    it('should calculate average savings', async () => {
      const stats = await metrics.getStats();
      expect(stats.averageSavingsPerSuggestion).toBe(583); // 1750 / 3 = 583.33 rounded
    });

    it('should filter stats by source', async () => {
      // For this test, we need to mock what the DB would return when filtered
      // In a real DB, the filter would be applied in SQL.
      // Here, getStats calls query() which calls db.allAsync.
      // We need to ensure that if query is called with filters, we return filtered data?
      // Or we just verify that getStats passes the filter to query.

      // Since we can't easily change the mock based on arguments in this simple setup
      // (without making mockAllAsync implementation complex), we'll assume the DB returns
      // correctly filtered data.

      const filteredMetrics = mockMetrics.filter(m => m.source === 'enforcer-hook');
      mockAllAsync.mockResolvedValueOnce(filteredMetrics);

      const stats = await metrics.getStats({ source: 'enforcer-hook' });
      expect(stats.totalSuggestions).toBe(2);
      expect(stats.totalEstimatedSavings).toBe(250);

      // Verify query was called with correct filter
      expect(mockAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('source = ?'),
        expect.arrayContaining(['enforcer-hook'])
      );
    });
  });

  describe('updateActualSavings', () => {
    it('should update actual token savings for a metric', async () => {
      await metrics.updateActualSavings('metric_123', 95);

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE token_savings_metrics'),
        expect.arrayContaining([95, 'metric_123'])
      );
    });
  });

  describe('getSummaryReport', () => {
    beforeEach(() => {
      const mockMetrics = [
        {
          id: '1',
          timestamp: Date.now(),
          source: 'enforcer-hook',
          blocked_tool: 'Read',
          recommended_tool: 'serena',
          target: 'file.ts',
          estimated_savings: 100,
          actual_tokens_avoided: null,
          suggestion_followed: 1,
          metadata: '{}'
        }
      ];
      mockAllAsync.mockResolvedValue(mockMetrics);
    });

    it('should generate a summary report', async () => {
      const report = await metrics.getSummaryReport(7);

      expect(report).toContain('Token Savings Report');
      expect(report).toContain('Total suggestions: 1');
      expect(report).toContain('Total estimated savings: 100 tokens');
      expect(report).toContain('By Blocked Tool:');
      expect(report).toContain('Read:');
    });
  });

  describe('getMetricsCollector singleton', () => {
    it('should return the same instance', async () => {
      const instance1 = await getMetricsCollector();
      const instance2 = await getMetricsCollector();
      expect(instance1).toBe(instance2);
    });
  });
});
