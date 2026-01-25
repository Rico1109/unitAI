/**
 * Unit tests for auditTrail.ts
 *
 * SECURITY/AUDIT: Tests audit log integrity and querying
 * Target Coverage: 85%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AuditTrail,
  AuditEntry,
  resetAuditTrail,
} from '../../src/utils/auditTrail';
import Database from 'better-sqlite3';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock getDependencies to avoid actual DI container
vi.mock('../../src/dependencies.js', () => ({
  getDependencies: vi.fn(() => ({
    auditDb: new Database(':memory:'),
  })),
}));

describe('auditTrail', () => {
  let db: Database.Database;
  let auditTrail: AuditTrail;

  beforeEach(() => {
    // Create fresh in-memory database
    db = new Database(':memory:');
    auditTrail = new AuditTrail(db);
  });

  afterEach(() => {
    db.close();
    resetAuditTrail();
  });

  // =================================================================
  // Suite 1: Schema Initialization
  // =================================================================
  describe('Schema Initialization', () => {
    it('should create audit_entries table', () => {
      // Arrange & Act: Constructor already called in beforeEach

      // Assert: Check table exists
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='audit_entries'"
      ).all();

      expect(tables).toHaveLength(1);
    });

    it('should create required indexes', () => {
      // Arrange & Act: Constructor already called

      // Assert: Check indexes exist
      const indexes = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='audit_entries'"
      ).all() as any[];

      const indexNames = indexes.map(idx => idx.name);
      expect(indexNames).toContain('idx_audit_timestamp');
      expect(indexNames).toContain('idx_audit_workflow');
      expect(indexNames).toContain('idx_audit_autonomy');
      expect(indexNames).toContain('idx_audit_operation');
      expect(indexNames).toContain('idx_audit_outcome');
    });
  });

  // =================================================================
  // Suite 2: Recording Entries
  // =================================================================
  describe('Recording Entries', () => {
    it('should record a basic audit entry', () => {
      // Arrange
      const entry = {
        workflowName: 'test-workflow',
        autonomyLevel: 'medium' as const,
        operation: 'file_write' as const,
        target: 'test.txt',
        approved: true,
        executedBy: 'system' as const,
        outcome: 'success' as const,
        metadata: { test: true },
      };

      // Act
      auditTrail.record(entry);

      // Assert: Query back
      const rows = db.prepare('SELECT * FROM audit_entries').all();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        workflow_name: 'test-workflow',
        autonomy_level: 'medium',
        operation: 'file_write',
        target: 'test.txt',
        approved: 1,
        executed_by: 'system',
        outcome: 'success',
      });
    });

    it('should generate unique IDs for each entry', () => {
      // Arrange
      const entry = {
        workflowName: 'test',
        autonomyLevel: 'low' as const,
        operation: 'git_commit' as const,
        target: 'commit',
        approved: true,
        executedBy: 'user' as const,
        outcome: 'success' as const,
        metadata: {},
      };

      // Act
      auditTrail.record(entry);
      auditTrail.record(entry);

      // Assert
      const rows = db.prepare('SELECT id FROM audit_entries').all() as any[];
      expect(rows).toHaveLength(2);
      expect(rows[0].id).not.toBe(rows[1].id);
    });

    it('should store timestamp automatically', () => {
      // Arrange
      const before = Date.now();
      const entry = {
        workflowName: 'test',
        autonomyLevel: 'high' as const,
        operation: 'command_exec' as const,
        target: 'cmd',
        approved: false,
        executedBy: 'system' as const,
        outcome: 'pending' as const,
        metadata: {},
      };

      // Act
      auditTrail.record(entry);
      const after = Date.now();

      // Assert
      const row = db.prepare('SELECT timestamp FROM audit_entries').get() as any;
      expect(row.timestamp).toBeGreaterThanOrEqual(before);
      expect(row.timestamp).toBeLessThanOrEqual(after);
    });

    it('should handle optional fields (workflowId, errorMessage)', () => {
      // Arrange
      const entry = {
        workflowName: 'test',
        workflowId: 'wf-123',
        autonomyLevel: 'medium' as const,
        operation: 'file_read' as const,
        target: 'file.txt',
        approved: true,
        executedBy: 'system' as const,
        outcome: 'failure' as const,
        errorMessage: 'File not found',
        metadata: {},
      };

      // Act
      auditTrail.record(entry);

      // Assert
      const row = db.prepare('SELECT * FROM audit_entries').get() as any;
      expect(row.workflow_id).toBe('wf-123');
      expect(row.error_message).toBe('File not found');
    });

    it('should serialize metadata as JSON', () => {
      // Arrange
      const complexMetadata = {
        files: ['a.txt', 'b.txt'],
        count: 42,
        nested: { key: 'value' },
      };

      const entry = {
        workflowName: 'test',
        autonomyLevel: 'low' as const,
        operation: 'file_write' as const,
        target: 'target',
        approved: true,
        executedBy: 'user' as const,
        outcome: 'success' as const,
        metadata: complexMetadata,
      };

      // Act
      auditTrail.record(entry);

      // Assert
      const row = db.prepare('SELECT metadata FROM audit_entries').get() as any;
      expect(JSON.parse(row.metadata)).toEqual(complexMetadata);
    });
  });

  // =================================================================
  // Suite 3: Querying Entries
  // =================================================================
  describe('Querying Entries', () => {
    beforeEach(() => {
      // Seed data
      auditTrail.record({
        workflowName: 'workflow-a',
        workflowId: 'wf-1',
        autonomyLevel: 'low' as const,
        operation: 'file_write' as const,
        target: 'file1.txt',
        approved: true,
        executedBy: 'system' as const,
        outcome: 'success' as const,
        metadata: {},
      });

      auditTrail.record({
        workflowName: 'workflow-b',
        workflowId: 'wf-2',
        autonomyLevel: 'high' as const,
        operation: 'git_commit' as const,
        target: 'commit-msg',
        approved: false,
        executedBy: 'user' as const,
        outcome: 'failure' as const,
        errorMessage: 'Permission denied',
        metadata: {},
      });

      auditTrail.record({
        workflowName: 'workflow-a',
        autonomyLevel: 'medium' as const,
        operation: 'command_exec' as const,
        target: 'npm test',
        approved: true,
        executedBy: 'system' as const,
        outcome: 'success' as const,
        metadata: {},
      });
    });

    it('should query all entries without filters', () => {
      // Act
      const entries = auditTrail.query();

      // Assert
      expect(entries).toHaveLength(3);
      expect(entries[0]).toHaveProperty('id');
      expect(entries[0]).toHaveProperty('timestamp');
      expect(entries[0].timestamp).toBeInstanceOf(Date);
    });

    it('should filter by workflowName', () => {
      // Act
      const entries = auditTrail.query({ workflowName: 'workflow-a' });

      // Assert
      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.workflowName === 'workflow-a')).toBe(true);
    });

    it('should filter by workflowId', () => {
      // Act
      const entries = auditTrail.query({ workflowId: 'wf-2' });

      // Assert
      expect(entries).toHaveLength(1);
      expect(entries[0].workflowId).toBe('wf-2');
    });

    it('should filter by autonomyLevel', () => {
      // Act
      const entries = auditTrail.query({ autonomyLevel: 'high' });

      // Assert
      expect(entries).toHaveLength(1);
      expect(entries[0].autonomyLevel).toBe('high');
    });

    it('should filter by operation', () => {
      // Act
      const entries = auditTrail.query({ operation: 'git_commit' });

      // Assert
      expect(entries).toHaveLength(1);
      expect(entries[0].operation).toBe('git_commit');
    });

    it('should filter by approved status', () => {
      // Act
      const approved = auditTrail.query({ approved: true });
      const denied = auditTrail.query({ approved: false });

      // Assert
      expect(approved).toHaveLength(2);
      expect(denied).toHaveLength(1);
    });

    it('should filter by outcome', () => {
      // Act
      const successful = auditTrail.query({ outcome: 'success' });
      const failed = auditTrail.query({ outcome: 'failure' });

      // Assert
      expect(successful).toHaveLength(2);
      expect(failed).toHaveLength(1);
    });

    it('should filter by time range', () => {
      // Arrange
      const now = new Date();
      const past = new Date(now.getTime() - 1000);
      const future = new Date(now.getTime() + 1000);

      // Act
      const entries = auditTrail.query({
        startTime: past,
        endTime: future,
      });

      // Assert: All entries are within range
      expect(entries).toHaveLength(3);
    });

    it('should limit results', () => {
      // Act
      const entries = auditTrail.query({ limit: 2 });

      // Assert
      expect(entries).toHaveLength(2);
    });

    it('should order by timestamp DESC', () => {
      // Act
      const entries = auditTrail.query();

      // Assert: Most recent first
      for (let i = 0; i < entries.length - 1; i++) {
        expect(entries[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          entries[i + 1].timestamp.getTime()
        );
      }
    });

    it('should combine multiple filters', () => {
      // Act
      const entries = auditTrail.query({
        workflowName: 'workflow-a',
        approved: true,
        outcome: 'success',
      });

      // Assert
      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.workflowName === 'workflow-a')).toBe(true);
      expect(entries.every(e => e.approved === true)).toBe(true);
    });
  });

  // =================================================================
  // Suite 4: Statistics
  // =================================================================
  describe('Statistics', () => {
    beforeEach(() => {
      // Seed varied data
      for (let i = 0; i < 10; i++) {
        auditTrail.record({
          workflowName: i < 5 ? 'workflow-a' : 'workflow-b',
          autonomyLevel: i < 3 ? 'low' : i < 7 ? 'medium' : 'high' as const,
          operation: i % 2 === 0 ? 'file_write' : 'git_commit' as const,
          target: `target-${i}`,
          approved: i < 8,
          executedBy: 'system' as const,
          outcome: i < 7 ? 'success' : 'failure' as const,
          metadata: {},
        });
      }
    });

    it('should calculate total entries', () => {
      // Act
      const stats = auditTrail.getStats();

      // Assert
      expect(stats.totalEntries).toBe(10);
    });

    it('should calculate approved vs denied operations', () => {
      // Act
      const stats = auditTrail.getStats();

      // Assert
      expect(stats.approvedOperations).toBe(8);
      expect(stats.deniedOperations).toBe(2);
    });

    it('should calculate successful vs failed operations', () => {
      // Act
      const stats = auditTrail.getStats();

      // Assert
      expect(stats.successfulOperations).toBe(7);
      expect(stats.failedOperations).toBe(3);
    });

    it('should group by autonomy level', () => {
      // Act
      const stats = auditTrail.getStats();

      // Assert
      expect(stats.byAutonomyLevel).toEqual({
        low: 3,
        medium: 4,
        high: 3,
      });
    });

    it('should group by operation', () => {
      // Act
      const stats = auditTrail.getStats();

      // Assert
      expect(stats.byOperation).toEqual({
        file_write: 5,
        git_commit: 5,
      });
    });

    it('should filter stats by workflowName', () => {
      // Act
      const stats = auditTrail.getStats({ workflowName: 'workflow-a' });

      // Assert
      expect(stats.totalEntries).toBe(5);
    });

    it('should filter stats by time range', () => {
      // Arrange
      const past = new Date(Date.now() - 10000);
      const future = new Date(Date.now() + 10000);

      // Act
      const stats = auditTrail.getStats({
        startTime: past,
        endTime: future,
      });

      // Assert
      expect(stats.totalEntries).toBe(10);
    });
  });

  // =================================================================
  // Suite 5: Export Formats
  // =================================================================
  describe('Export Formats', () => {
    beforeEach(() => {
      auditTrail.record({
        workflowName: 'test-workflow',
        autonomyLevel: 'medium' as const,
        operation: 'file_write' as const,
        target: 'test.txt',
        approved: true,
        executedBy: 'system' as const,
        outcome: 'success' as const,
        metadata: { key: 'value' },
      });
    });

    it('should export as JSON', () => {
      // Act
      const json = auditTrail.exportReport('json');

      // Assert
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].workflowName).toBe('test-workflow');
    });

    it('should export as CSV', () => {
      // Act
      const csv = auditTrail.exportReport('csv');

      // Assert
      const lines = csv.split('\n');
      expect(lines[0]).toContain('ID,Timestamp,Workflow');
      expect(lines[1]).toContain('test-workflow');
      expect(lines[1]).toContain('medium');
    });

    it('should export as HTML', () => {
      // Act
      const html = auditTrail.exportReport('html');

      // Assert
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Audit Trail Report</title>');
      expect(html).toContain('test-workflow');
      expect(html).toContain('Statistics');
    });

    it('should apply filters to exports', () => {
      // Arrange
      auditTrail.record({
        workflowName: 'another-workflow',
        autonomyLevel: 'low' as const,
        operation: 'git_commit' as const,
        target: 'commit',
        approved: false,
        executedBy: 'user' as const,
        outcome: 'failure' as const,
        metadata: {},
      });

      // Act
      const json = auditTrail.exportReport('json', {
        workflowName: 'test-workflow',
      });

      // Assert
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].workflowName).toBe('test-workflow');
    });
  });

  // =================================================================
  // Suite 6: Cleanup
  // =================================================================
  describe('Cleanup', () => {
    it('should delete old entries', () => {
      // Arrange: Insert old entry manually
      const oldTimestamp = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      db.prepare(`
        INSERT INTO audit_entries
        (id, timestamp, workflow_name, autonomy_level, operation, target, approved, executed_by, outcome, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'old-entry',
        oldTimestamp,
        'old-workflow',
        'low',
        'file_write',
        'old.txt',
        1,
        'system',
        'success',
        '{}'
      );

      // Add recent entry
      auditTrail.record({
        workflowName: 'recent',
        autonomyLevel: 'medium' as const,
        operation: 'file_write' as const,
        target: 'recent.txt',
        approved: true,
        executedBy: 'system' as const,
        outcome: 'success' as const,
        metadata: {},
      });

      // Act: Keep only last 7 days
      const deletedCount = auditTrail.cleanup(7);

      // Assert
      expect(deletedCount).toBe(1);
      const remaining = db.prepare('SELECT * FROM audit_entries').all();
      expect(remaining).toHaveLength(1);
      expect((remaining[0] as any).workflow_name).toBe('recent');
    });

    it('should return count of deleted entries', () => {
      // Arrange: Add multiple old entries
      const oldTimestamp = Date.now() - (100 * 24 * 60 * 60 * 1000);
      for (let i = 0; i < 5; i++) {
        db.prepare(`
          INSERT INTO audit_entries
          (id, timestamp, workflow_name, autonomy_level, operation, target, approved, executed_by, outcome, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `old-${i}`,
          oldTimestamp,
          'old',
          'low',
          'file_write',
          'old',
          1,
          'system',
          'success',
          '{}'
        );
      }

      // Act
      const deletedCount = auditTrail.cleanup(30);

      // Assert
      expect(deletedCount).toBe(5);
    });
  });

  // =================================================================
  // Suite 7: Database Operations
  // =================================================================
  describe('Database Operations', () => {
    it('should close database connection', () => {
      // Arrange
      const testDb = new Database(':memory:');
      const testAudit = new AuditTrail(testDb);

      // Act
      testAudit.close();

      // Assert: Further operations should fail
      expect(() => testDb.prepare('SELECT 1').get()).toThrow();
    });
  });
});
