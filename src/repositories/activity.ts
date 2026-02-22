/**
 * Activity Repository
 *
 * Data access layer for MCP Activities.
 */
import { BaseRepository } from "./base.js";
import { MCPActivity } from "../domain/common/activity.js";
import { logger } from "../utils/logger.js";

export class ActivityRepository extends BaseRepository {

    async initializeSchema(): Promise<void> {
        await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS mcp_activities (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        activity_type TEXT NOT NULL,
        tool_name TEXT,
        workflow_name TEXT,
        agent_name TEXT,
        duration INTEGER,
        success INTEGER NOT NULL,
        error_message TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON mcp_activities(timestamp);
      CREATE INDEX IF NOT EXISTS idx_activity_type ON mcp_activities(activity_type);
      CREATE INDEX IF NOT EXISTS idx_activity_tool ON mcp_activities(tool_name);
      CREATE INDEX IF NOT EXISTS idx_activity_workflow ON mcp_activities(workflow_name);
      CREATE INDEX IF NOT EXISTS idx_activity_success ON mcp_activities(success);
    `);
    }

    async create(activity: Omit<MCPActivity, 'id' | 'timestamp'> & { id: string, timestamp: number }): Promise<void> {
        const sql = `
        INSERT INTO mcp_activities (
          id, timestamp, activity_type, tool_name, workflow_name,
          agent_name, duration, success, error_message, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

        await this.db.runAsync(sql, [
            activity.id,
            activity.timestamp,
            activity.activityType,
            activity.toolName || null,
            activity.workflowName || null,
            activity.agentName || null,
            activity.duration || null,
            activity.success ? 1 : 0,
            activity.errorMessage || null,
            JSON.stringify(activity.metadata || {})
        ]);
    }

    async query(filters: {
        activityType?: string;
        toolName?: string;
        workflowName?: string;
        startTime?: number;
        endTime?: number;
        success?: boolean;
        limit?: number;
    }): Promise<MCPActivity[]> {
        let sql = 'SELECT * FROM mcp_activities WHERE 1=1';
        const params: any[] = [];

        if (filters.activityType) {
            sql += ' AND activity_type = ?';
            params.push(filters.activityType);
        }

        if (filters.toolName) {
            sql += ' AND tool_name = ?';
            params.push(filters.toolName);
        }

        if (filters.workflowName) {
            sql += ' AND workflow_name = ?';
            params.push(filters.workflowName);
        }

        if (filters.startTime) {
            sql += ' AND timestamp >= ?';
            params.push(filters.startTime);
        }

        if (filters.endTime) {
            sql += ' AND timestamp <= ?';
            params.push(filters.endTime);
        }

        if (filters.success !== undefined) {
            sql += ' AND success = ?';
            params.push(filters.success ? 1 : 0);
        }

        sql += ' ORDER BY timestamp DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        const rows = await this.db.allAsync(sql, params);
        return rows.map((row: any) => this.rowToActivity(row));
    }

    async cleanup(cutoffTimestamp: number): Promise<number> {
        const sql = 'DELETE FROM mcp_activities WHERE timestamp < ?';
        const result = await this.db.runAsync(sql, [cutoffTimestamp]);
        return result.changes;
    }

    private rowToActivity(row: any): MCPActivity {
        return {
            id: row.id,
            timestamp: new Date(row.timestamp),
            activityType: row.activity_type,
            toolName: row.tool_name || undefined,
            workflowName: row.workflow_name || undefined,
            agentName: row.agent_name || undefined,
            duration: row.duration || undefined,
            success: row.success === 1,
            errorMessage: row.error_message || undefined,
            metadata: JSON.parse(row.metadata || '{}')
        };
    }
}
