/**
 * Tests for Activity Analytics Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActivityAnalytics } from '../../../src/services/activityAnalytics.js';
import { ActivityRepository } from '../../../src/repositories/activity.js';
import { AuditTrail } from '../../../src/utils/auditTrail.js';
import { TokenSavingsMetrics } from '../../../src/utils/tokenEstimator.js';
import { createTestDependencies } from '../../utils/testDependencies.js';
import type Database from 'better-sqlite3';

describe('ActivityAnalytics', () => {
  let analytics: ActivityAnalytics;
  let testDeps: {
    activityDb: Database.Database;
    auditDb: Database.Database;
    tokenDb: Database.Database;
  };

  beforeEach(() => {
    // Create in-memory test databases
    testDeps = createTestDependencies();

    // Create dependencies
    const repo = new ActivityRepository(testDeps.activityDb);
    const audit = new AuditTrail(testDeps.auditDb);
    const tokens = new TokenSavingsMetrics(testDeps.tokenDb);

    // Create analytics instance with injected dependencies
    analytics = new ActivityAnalytics(repo, audit, tokens);
  });

  afterEach(() => {
    // Cleanup in-memory databases
    analytics.close();
    testDeps.activityDb.close();
    testDeps.auditDb.close();
    testDeps.tokenDb.close();
  });

  describe('recordActivity', () => {
    it('should record a tool invocation activity', () => {
      const activityId = analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'ask-gemini',
        success: true,
        duration: 1500,
        metadata: { prompt: 'test prompt' }
      });

      expect(activityId).toMatch(/^activity_/);
    });

    it('should record a workflow execution activity', () => {
      const activityId = analytics.recordActivity({
        activityType: 'workflow_execution',
        workflowName: 'bug-hunt',
        success: true,
        duration: 5000,
        metadata: { filesAnalyzed: 10 }
      });

      expect(activityId).toMatch(/^activity_/);
    });

    it('should record a failed activity with error message', () => {
      const activityId = analytics.recordActivity({
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
    beforeEach(() => {
      // Add test data
      analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'ask-gemini',
        success: true,
        duration: 1000,
        metadata: {}
      });

      analytics.recordActivity({
        activityType: 'workflow_execution',
        workflowName: 'bug-hunt',
        success: true,
        duration: 3000,
        metadata: {}
      });
    });

    it('should query all activities', () => {
      const activities = analytics.queryActivities();
      expect(activities.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by activity type', () => {
      const activities = analytics.queryActivities({
        activityType: 'tool_invocation'
      });

      expect(activities.length).toBeGreaterThanOrEqual(1);
      expect(activities.every(a => a.activityType === 'tool_invocation')).toBe(true);
    });

    it('should filter by tool name', () => {
      const activities = analytics.queryActivities({
        toolName: 'ask-gemini'
      });

      expect(activities.length).toBeGreaterThanOrEqual(1);
      expect(activities.every(a => a.toolName === 'ask-gemini')).toBe(true);
    });

    it('should filter by success status', () => {
      analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'test-tool',
        success: false,
        metadata: {}
      });

      const failedActivities = analytics.queryActivities({
        success: false
      });

      expect(failedActivities.length).toBeGreaterThanOrEqual(1);
      expect(failedActivities.every(a => !a.success)).toBe(true);
    });

    it('should limit results', () => {
      const activities = analytics.queryActivities({ limit: 1 });
      expect(activities.length).toBe(1);
    });
  });

  describe('getActivitySummary', () => {
    beforeEach(() => {
      // Add varied test data
      for (let i = 0; i < 5; i++) {
        analytics.recordActivity({
          activityType: 'tool_invocation',
          toolName: 'ask-gemini',
          success: true,
          duration: 1000 + i * 100,
          metadata: {}
        });
      }

      for (let i = 0; i < 3; i++) {
        analytics.recordActivity({
          activityType: 'workflow_execution',
          workflowName: 'bug-hunt',
          success: i < 2, // 2 successful, 1 failed
          duration: 3000 + i * 500,
          metadata: {}
        });
      }
    });

    it('should generate activity summary', () => {
      const summary = analytics.getActivitySummary(7);

      expect(summary).toBeDefined();
      expect(summary.period).toBe('Last 7 days');
      expect(summary.toolInvocations).toBeGreaterThanOrEqual(5);
      expect(summary.workflowExecutions).toBeGreaterThanOrEqual(3);
    });

    it('should calculate success rate', () => {
      const summary = analytics.getActivitySummary(7);
      expect(summary.successRate).toBeGreaterThan(0);
      expect(summary.successRate).toBeLessThanOrEqual(1);
    });

    it('should include top tools', () => {
      const summary = analytics.getActivitySummary(7);
      expect(summary.topTools.length).toBeGreaterThan(0);
      
      const geminiTool = summary.topTools.find(t => t.toolName === 'ask-gemini');
      expect(geminiTool).toBeDefined();
      expect(geminiTool?.invocations).toBeGreaterThanOrEqual(5);
    });

    it('should include top workflows', () => {
      const summary = analytics.getActivitySummary(7);
      expect(summary.topWorkflows.length).toBeGreaterThan(0);
      
      const bugHuntWorkflow = summary.topWorkflows.find(w => w.workflowName === 'bug-hunt');
      expect(bugHuntWorkflow).toBeDefined();
      expect(bugHuntWorkflow?.executions).toBeGreaterThanOrEqual(3);
    });

    it('should include activity patterns', () => {
      const summary = analytics.getActivitySummary(7);
      
      expect(summary.activityByHour).toBeDefined();
      expect(summary.activityByHour.length).toBe(24); // All hours
      
      expect(summary.activityByDay).toBeDefined();
      expect(summary.activityByDay.length).toBeGreaterThan(0);
    });
  });

  describe('getToolStats', () => {
    beforeEach(() => {
      analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'test-tool',
        success: true,
        duration: 1000,
        metadata: {}
      });

      analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'test-tool',
        success: false,
        duration: 500,
        metadata: {}
      });
    });

    it('should return tool statistics', () => {
      const stats = analytics.getToolStats('test-tool', 7);

      expect(stats).toBeDefined();
      expect(stats?.toolName).toBe('test-tool');
      expect(stats?.invocations).toBe(2);
      expect(stats?.successRate).toBe(0.5); // 1 success out of 2
      expect(stats?.avgResponseTime).toBeDefined();
    });

    it('should return null for non-existent tool', () => {
      const stats = analytics.getToolStats('non-existent-tool', 7);
      expect(stats).toBeNull();
    });
  });

  describe('getWorkflowStats', () => {
    beforeEach(() => {
      analytics.recordActivity({
        activityType: 'workflow_execution',
        workflowName: 'test-workflow',
        success: true,
        duration: 3000,
        metadata: {}
      });

      analytics.recordActivity({
        activityType: 'workflow_execution',
        workflowName: 'test-workflow',
        success: true,
        duration: 2500,
        metadata: {}
      });
    });

    it('should return workflow statistics', () => {
      const stats = analytics.getWorkflowStats('test-workflow', 7);

      expect(stats).toBeDefined();
      expect(stats?.workflowName).toBe('test-workflow');
      expect(stats?.executions).toBe(2);
      expect(stats?.successCount).toBe(2);
      expect(stats?.failureCount).toBe(0);
      expect(stats?.avgDuration).toBeDefined();
    });

    it('should return null for non-existent workflow', () => {
      const stats = analytics.getWorkflowStats('non-existent-workflow', 7);
      expect(stats).toBeNull();
    });
  });

  describe('getRecentActivities', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        analytics.recordActivity({
          activityType: 'tool_invocation',
          toolName: `tool-${i}`,
          success: true,
          metadata: {}
        });
      }
    });

    it('should return recent activities', () => {
      const activities = analytics.getRecentActivities(5);
      expect(activities.length).toBe(5);
    });

    it('should return activities in descending order', () => {
      const activities = analytics.getRecentActivities(10);
      
      for (let i = 0; i < activities.length - 1; i++) {
        expect(activities[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          activities[i + 1].timestamp.getTime()
        );
      }
    });
  });

  describe('cleanup', () => {
    it('should remove old activities', () => {
      vi.useFakeTimers();
      const now = new Date('2026-01-25T10:00:00Z');
      vi.setSystemTime(now);

      // Record an activity at current time
      analytics.recordActivity({
        activityType: 'tool_invocation',
        toolName: 'test-tool',
        success: true,
        metadata: {}
      });

      // Advance time by 10 days
      vi.setSystemTime(new Date('2026-02-04T10:00:00Z'));

      // Cleanup activities older than 7 days (should remove our activity)
      const removed = analytics.cleanup(7);
      expect(removed).toBeGreaterThanOrEqual(1);
      
      // Check that activities were removed
      const activities = analytics.queryActivities();
      expect(activities.length).toBe(0);

      vi.useRealTimers();
    });
  });
});