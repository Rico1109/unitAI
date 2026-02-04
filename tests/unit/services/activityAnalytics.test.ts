/**
 * Tests for Activity Analytics Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActivityAnalytics } from '../../../src/services/activityAnalytics.js';
import { ActivityRepository } from '../../../src/repositories/activity.js';
import { AuditTrail } from '../../../src/services/audit-trail.js';
import { TokenSavingsMetrics } from '../../../src/services/token-estimator.js';
import { createTestDependencies } from '../../utils/testDependencies.js';
import type Database from 'better-sqlite3';
import type { AsyncDatabase } from '../../../src/infrastructure/async-db.js';

describe('ActivityAnalytics', () => {
  let analytics: ActivityAnalytics;
  let testDeps: {
    activityDb: AsyncDatabase;
    auditDb: AsyncDatabase;
    tokenDb: Database.Database;
  };

  beforeEach(async () => {
    // Create in-memory test databases
    testDeps = createTestDependencies();

    // Create dependencies
    const repo = new ActivityRepository(testDeps.activityDb);
    await repo.initializeSchema();
    const audit = new AuditTrail(testDeps.auditDb);
    await audit.initializeSchema();
    const tokens = new TokenSavingsMetrics(testDeps.tokenDb);

    // Create analytics instance with injected dependencies
    analytics = new ActivityAnalytics(repo, audit, tokens);
  });

  afterEach(async () => {
    // Cleanup in-memory databases
    analytics.close();
    await testDeps.activityDb.closeAsync();
    await testDeps.auditDb.closeAsync();
    testDeps.tokenDb.close();
  });

  describe('recordActivity', () => {
    it('should record a tool invocation activity', async () => {
      const activityId = await analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'ask-gemini',
        success: true,
        duration: 1500,
        metadata: { prompt: 'test prompt' }
      });

      expect(activityId).toMatch(/^activity_/);
    });

    it('should record a workflow execution activity', async () => {
      const activityId = await analytics.recordActivity({
        activityType: 'workflow_execution',
        workflowName: 'bug-hunt',
        success: true,
        duration: 5000,
        metadata: { filesAnalyzed: 10 }
      });

      expect(activityId).toMatch(/^activity_/);
    });

    it('should record a failed activity with error message', async () => {
      const activityId = await analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'ask-qwen',
        success: false,
        errorMessage: 'Connection timeout',
        metadata: {}
      });

      expect(activityId).toMatch(/^activity_/);
    });
  });

  describe('queryActivities', () => {
    beforeEach(async () => {
      // Add test data
      await analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'ask-gemini',
        success: true,
        duration: 1000,
        metadata: {}
      });

      await analytics.recordActivity({
        activityType: 'workflow_execution',
        workflowName: 'bug-hunt',
        success: true,
        duration: 3000,
        metadata: {}
      });
    });

    it('should query all activities', async () => {
      const activities = await analytics.queryActivities();
      expect(activities.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by activity type', async () => {
      const activities = await analytics.queryActivities({
        activityType: 'tool_invocation'
      });

      expect(activities.length).toBeGreaterThanOrEqual(1);
      expect(activities.every(a => a.activityType === 'tool_invocation')).toBe(true);
    });

    it('should filter by tool name', async () => {
      const activities = await analytics.queryActivities({
        toolName: 'ask-gemini'
      });

      expect(activities.length).toBeGreaterThanOrEqual(1);
      expect(activities.every(a => a.toolName === 'ask-gemini')).toBe(true);
    });

    it('should filter by success status', async () => {
      await analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'test-tool',
        success: false,
        metadata: {}
      });

      const failedActivities = await analytics.queryActivities({
        success: false
      });

      expect(failedActivities.length).toBeGreaterThanOrEqual(1);
      expect(failedActivities.every(a => !a.success)).toBe(true);
    });

    it('should limit results', async () => {
      const activities = await analytics.queryActivities({ limit: 1 });
      expect(activities.length).toBe(1);
    });
  });

  describe('getActivitySummary', () => {
    beforeEach(async () => {
      // Add varied test data
      for (let i = 0; i < 5; i++) {
        await analytics.recordActivity({
          activityType: 'tool_invocation',
          toolName: 'ask-gemini',
          success: true,
          duration: 1000 + i * 100,
          metadata: {}
        });
      }

      for (let i = 0; i < 3; i++) {
        await analytics.recordActivity({
          activityType: 'workflow_execution',
          workflowName: 'bug-hunt',
          success: i < 2, // 2 successful, 1 failed
          duration: 3000 + i * 500,
          metadata: {}
        });
      }
    });

    it('should generate activity summary', async () => {
      const summary = await analytics.getActivitySummary(7);

      expect(summary).toBeDefined();
      expect(summary.period).toBe('Last 7 days');
      expect(summary.toolInvocations).toBeGreaterThanOrEqual(5);
      expect(summary.workflowExecutions).toBeGreaterThanOrEqual(3);
    });

    it('should calculate success rate', async () => {
      const summary = await analytics.getActivitySummary(7);
      expect(summary.successRate).toBeGreaterThan(0);
      expect(summary.successRate).toBeLessThanOrEqual(1);
    });

    it('should include top tools', async () => {
      const summary = await analytics.getActivitySummary(7);
      expect(summary.topTools.length).toBeGreaterThan(0);

      const geminiTool = summary.topTools.find(t => t.toolName === 'ask-gemini');
      expect(geminiTool).toBeDefined();
      expect(geminiTool?.invocations).toBeGreaterThanOrEqual(5);
    });

    it('should include top workflows', async () => {
      const summary = await analytics.getActivitySummary(7);
      expect(summary.topWorkflows.length).toBeGreaterThan(0);

      const bugHuntWorkflow = summary.topWorkflows.find(w => w.workflowName === 'bug-hunt');
      expect(bugHuntWorkflow).toBeDefined();
      expect(bugHuntWorkflow?.executions).toBeGreaterThanOrEqual(3);
    });

    it('should include activity patterns', async () => {
      const summary = await analytics.getActivitySummary(7);

      expect(summary.activityByHour).toBeDefined();
      expect(summary.activityByHour.length).toBe(24); // All hours

      expect(summary.activityByDay).toBeDefined();
      expect(summary.activityByDay.length).toBeGreaterThan(0);
    });
  });

  describe('getToolStats', () => {
    beforeEach(async () => {
      await analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'test-tool',
        success: true,
        duration: 1000,
        metadata: {}
      });

      await analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'test-tool',
        success: false,
        duration: 500,
        metadata: {}
      });
    });

    it('should return tool statistics', async () => {
      const stats = await analytics.getToolStats('test-tool', 7);

      expect(stats).toBeDefined();
      expect(stats?.toolName).toBe('test-tool');
      expect(stats?.invocations).toBe(2);
      expect(stats?.successRate).toBe(0.5); // 1 success out of 2
      expect(stats?.avgResponseTime).toBeDefined();
    });

    it('should return null for non-existent tool', async () => {
      const stats = await analytics.getToolStats('non-existent-tool', 7);
      expect(stats).toBeNull();
    });
  });

  describe('getWorkflowStats', () => {
    beforeEach(async () => {
      await analytics.recordActivity({
        activityType: 'workflow_execution',
        workflowName: 'test-workflow',
        success: true,
        duration: 3000,
        metadata: {}
      });

      await analytics.recordActivity({
        activityType: 'workflow_execution',
        workflowName: 'test-workflow',
        success: true,
        duration: 2500,
        metadata: {}
      });
    });

    it('should return workflow statistics', async () => {
      const stats = await analytics.getWorkflowStats('test-workflow', 7);

      expect(stats).toBeDefined();
      expect(stats?.workflowName).toBe('test-workflow');
      expect(stats?.executions).toBe(2);
      expect(stats?.successCount).toBe(2);
      expect(stats?.failureCount).toBe(0);
      expect(stats?.avgDuration).toBeDefined();
    });

    it('should return null for non-existent workflow', async () => {
      const stats = await analytics.getWorkflowStats('non-existent-workflow', 7);
      expect(stats).toBeNull();
    });
  });

  describe('getRecentActivities', () => {
    beforeEach(async () => {
      for (let i = 0; i < 10; i++) {
        await analytics.recordActivity({
          activityType: 'tool_invocation',
          toolName: `tool-${i}`,
          success: true,
          metadata: {}
        });
      }
    });

    it('should return recent activities', async () => {
      const activities = await analytics.getRecentActivities(5);
      expect(activities.length).toBe(5);
    });

    it('should return activities in descending order', async () => {
      const activities = await analytics.getRecentActivities(10);

      for (let i = 0; i < activities.length - 1; i++) {
        expect(activities[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          activities[i + 1].timestamp.getTime()
        );
      }
    });
  });

  describe('cleanup', () => {
    it('should remove old activities', async () => {
      vi.useFakeTimers();
      const now = new Date('2026-01-25T10:00:00Z');
      vi.setSystemTime(now);

      // Record an activity at current time
      await analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'test-tool',
        success: true,
        metadata: {}
      });

      // Advance time by 10 days
      vi.setSystemTime(new Date('2026-02-04T10:00:00Z'));

      // Cleanup activities older than 7 days (should remove our activity)
      const removed = await analytics.cleanup(7);
      expect(removed).toBeGreaterThanOrEqual(1);

      // Check that activities were removed
      const activities = await analytics.queryActivities();
      expect(activities.length).toBe(0);

      vi.useRealTimers();
    });
  });
});