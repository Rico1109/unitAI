/**
 * Audit Trail System for Autonomous Operations
 *
 * Tracks all autonomous decisions and operations for accountability and debugging.
 */
import { getDependencies } from '../dependencies.js';
/**
 * Audit Trail for tracking autonomous decisions
 */
export class AuditTrail {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Initialize database schema
     */
    async initializeSchema() {
        await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS audit_entries (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        workflow_name TEXT NOT NULL,
        workflow_id TEXT,
        autonomy_level TEXT NOT NULL,
        operation TEXT NOT NULL,
        target TEXT NOT NULL,
        approved INTEGER NOT NULL,
        executed_by TEXT NOT NULL,
        outcome TEXT NOT NULL,
        error_message TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_workflow ON audit_entries(workflow_name);
      CREATE INDEX IF NOT EXISTS idx_audit_workflow_id ON audit_entries(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_audit_autonomy ON audit_entries(autonomy_level);
      CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_entries(operation);
      CREATE INDEX IF NOT EXISTS idx_audit_outcome ON audit_entries(outcome);
    `);
    }
    /**
     * Record an audit entry
     */
    async record(entry) {
        const id = this.generateId();
        const timestamp = Date.now();
        const sql = `
      INSERT INTO audit_entries (
        id, timestamp, workflow_name, workflow_id, autonomy_level, operation,
        target, approved, executed_by, outcome, error_message, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await this.db.runAsync(sql, [
            id,
            timestamp,
            entry.workflowName,
            entry.workflowId || null,
            entry.autonomyLevel,
            entry.operation,
            entry.target,
            entry.approved ? 1 : 0,
            entry.executedBy,
            entry.outcome,
            entry.errorMessage || null,
            JSON.stringify(entry.metadata || {})
        ]);
    }
    /**
     * Query audit entries
     */
    async query(filters = {}) {
        let sql = 'SELECT * FROM audit_entries WHERE 1=1;';
        const params = [];
        if (filters.workflowName) {
            sql += ' AND workflow_name = ?';
            params.push(filters.workflowName);
        }
        if (filters.workflowId) {
            sql += ' AND workflow_id = ?';
            params.push(filters.workflowId);
        }
        if (filters.autonomyLevel) {
            sql += ' AND autonomy_level = ?';
            params.push(filters.autonomyLevel);
        }
        if (filters.operation) {
            sql += ' AND operation = ?';
            params.push(filters.operation);
        }
        if (filters.approved !== undefined) {
            sql += ' AND approved = ?';
            params.push(filters.approved ? 1 : 0);
        }
        if (filters.outcome) {
            sql += ' AND outcome = ?';
            params.push(filters.outcome);
        }
        if (filters.startTime) {
            sql += ' AND timestamp >= ?';
            params.push(filters.startTime.getTime());
        }
        if (filters.endTime) {
            sql += ' AND timestamp <= ?';
            params.push(filters.endTime.getTime());
        }
        sql += ' ORDER BY timestamp DESC';
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }
        const rows = await this.db.allAsync(sql, params);
        return rows.map((row) => this.rowToEntry(row));
    }
    /**
     * Get audit statistics
     */
    async getStats(filters) {
        let whereClause = ' WHERE 1=1';
        const params = [];
        if (filters?.workflowName) {
            whereClause += ' AND workflow_name = ?';
            params.push(filters.workflowName);
        }
        if (filters?.startTime) {
            whereClause += ' AND timestamp >= ?';
            params.push(filters.startTime.getTime());
        }
        if (filters?.endTime) {
            whereClause += ' AND timestamp <= ?';
            params.push(filters.endTime.getTime());
        }
        // Get counts
        const totalEntriesPromise = this.db.getAsync(`SELECT COUNT(*) as count FROM audit_entries${whereClause}`, params);
        const approvedOperationsPromise = this.db.getAsync(`SELECT COUNT(*) as count FROM audit_entries${whereClause} AND approved = 1`, params);
        const deniedOperationsPromise = this.db.getAsync(`SELECT COUNT(*) as count FROM audit_entries${whereClause} AND approved = 0`, params);
        const successfulOperationsPromise = this.db.getAsync(`SELECT COUNT(*) as count FROM audit_entries${whereClause} AND outcome = 'success'`, params);
        const failedOperationsPromise = this.db.getAsync(`SELECT COUNT(*) as count FROM audit_entries${whereClause} AND outcome = 'failure'`, params);
        // Get distribution by autonomy level
        const byAutonomyLevel = {};
        const autonomyLevelRowsPromise = this.db.allAsync(`SELECT autonomy_level, COUNT(*) as count FROM audit_entries${whereClause} GROUP BY autonomy_level`, params);
        // Get distribution by operation
        const byOperation = {};
        const operationRowsPromise = this.db.allAsync(`SELECT operation, COUNT(*) as count FROM audit_entries${whereClause} GROUP BY operation`, params);
        const [totalEntries, approvedOperations, deniedOperations, successfulOperations, failedOperations, autonomyLevelRows, operationRows] = await Promise.all([totalEntriesPromise, approvedOperationsPromise, deniedOperationsPromise, successfulOperationsPromise, failedOperationsPromise, autonomyLevelRowsPromise, operationRowsPromise]);
        for (const row of autonomyLevelRows) {
            byAutonomyLevel[row.autonomy_level] = row.count;
        }
        for (const row of operationRows) {
            byOperation[row.operation] = row.count;
        }
        return {
            totalEntries: totalEntries?.count ?? 0,
            approvedOperations: approvedOperations?.count ?? 0,
            deniedOperations: deniedOperations?.count ?? 0,
            successfulOperations: successfulOperations?.count ?? 0,
            failedOperations: failedOperations?.count ?? 0,
            byAutonomyLevel,
            byOperation
        };
    }
    /**
     * Export report in various formats
     */
    async exportReport(format, filters) {
        const entries = await this.query(filters);
        if (format === 'json') {
            return JSON.stringify(entries, null, 2);
        }
        if (format === 'csv') {
            const headers = [
                'ID',
                'Timestamp',
                'Workflow',
                'Autonomy Level',
                'Operation',
                'Target',
                'Approved',
                'Executed By',
                'Outcome',
                'Error Message'
            ];
            const rows = entries.map(entry => [
                entry.id,
                entry.timestamp.toISOString(),
                entry.workflowName,
                entry.autonomyLevel,
                entry.operation,
                entry.target,
                entry.approved ? 'Yes' : 'No',
                entry.executedBy,
                entry.outcome,
                entry.errorMessage || ''
            ]);
            return [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');
        }
        // HTML format
        const stats = await this.getStats(filters);
        const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Audit Trail Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .stat-box { background: white; padding: 10px; border-radius: 3px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #007bff; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #007bff; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .approved { color: green; }
    .denied { color: red; }
    .success { color: green; }
    .failure { color: red; }
  </style>
</head>
<body>
  <h1>Audit Trail Report</h1>
  
  <div class="stats">
    <h2>Statistics</h2>
    <div class="stats-grid">
      <div class="stat-box">
        <div>Total Entries</div>
        <div class="stat-value">${stats.totalEntries}</div>
      </div>
      <div class="stat-box">
        <div>Approved</div>
        <div class="stat-value">${stats.approvedOperations}</div>
      </div>
      <div class="stat-box">
        <div>Denied</div>
        <div class="stat-value">${stats.deniedOperations}</div>
      </div>
      <div class="stat-box">
        <div>Successful</div>
        <div class="stat-value">${stats.successfulOperations}</div>
      </div>
      <div class="stat-box">
        <div>Failed</div>
        <div class="stat-value">${stats.failedOperations}</div>
      </div>
    </div>
  </div>
  
  <h2>Audit Entries</h2>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Workflow</th>
        <th>Autonomy</th>
        <th>Operation</th>
        <th>Target</th>
        <th>Approved</th>
        <th>Outcome</th>
      </tr>
    </thead>
    <tbody>
      ${entries.map(entry => `
        <tr>
          <td>${entry.timestamp.toISOString()}</td>
          <td>${entry.workflowName}</td>
          <td>${entry.autonomyLevel}</td>
          <td>${entry.operation}</td>
          <td>${entry.target}</td>
          <td class="${entry.approved ? 'approved' : 'denied'}">
            ${entry.approved ? 'Yes' : 'No'}
          </td>
          <td class="${entry.outcome}">${entry.outcome}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
    `.trim();
        return html;
    }
    /**
     * Delete old entries
     */
    async cleanup(daysToKeep) {
        const cutoffTimestamp = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        const result = await this.db.runAsync('DELETE FROM audit_entries WHERE timestamp < ?', [cutoffTimestamp]);
        return result.changes;
    }
    /**
     * Close database connection
     */
    async close() {
        await this.db.closeAsync();
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }
    /**
     * Convert database row to AuditEntry
     */
    rowToEntry(row) {
        return {
            id: row.id,
            timestamp: new Date(row.timestamp),
            workflowName: row.workflow_name,
            workflowId: row.workflow_id || undefined,
            autonomyLevel: row.autonomy_level,
            operation: row.operation,
            target: row.target,
            approved: row.approved === 1,
            executedBy: row.executed_by,
            outcome: row.outcome,
            errorMessage: row.error_message || undefined,
            metadata: JSON.parse(row.metadata || '{}')
        };
    }
}
/**
 * Lazy singleton using DI container
 */
let auditTrailInstance = null;
let auditTrailPromise = null;
export function getAuditTrail() {
    if (auditTrailInstance) {
        return Promise.resolve(auditTrailInstance);
    }
    if (!auditTrailPromise) {
        auditTrailPromise = (async () => {
            const deps = getDependencies();
            const auditDb = deps.auditDb;
            auditTrailInstance = new AuditTrail(auditDb);
            await auditTrailInstance.initializeSchema();
            return auditTrailInstance;
        })();
    }
    return auditTrailPromise;
}
/**
 * Reset singleton for testing
 */
export function resetAuditTrail() {
    auditTrailInstance = null;
    auditTrailPromise = null;
}
/**
 * Helper function to log audit entries
 */
export async function logAudit(params) {
    const auditTrail = await getAuditTrail();
    await auditTrail.record({
        workflowName: params.workflowName || 'workflow',
        workflowId: params.workflowId,
        autonomyLevel: params.autonomyLevel,
        operation: params.operation,
        target: params.target || params.details.substring(0, 100),
        approved: true,
        executedBy: 'system',
        outcome: 'success',
        metadata: { details: params.details }
    });
}
//# sourceMappingURL=auditTrail.js.map