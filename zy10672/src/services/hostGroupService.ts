import pool from '../config/database';
import { HostGroup, HostInfo, ImportStatus, ImportError } from '../types';
import { createError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export class HostGroupService {
  static async createHostGroup(
    name: string,
    description: string | undefined,
    hosts: HostInfo[],
    createdBy: string
  ): Promise<HostGroup> {
    const result = await pool.query(
      `INSERT INTO host_groups (name, description, hosts, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description, JSON.stringify(hosts), createdBy]
    );
    return result.rows[0];
  }

  static async getHostGroup(id: string): Promise<HostGroup> {
    const result = await pool.query(
      `SELECT * FROM host_groups WHERE id = $1 AND is_deleted = false`,
      [id]
    );

    if (result.rows.length === 0) {
      throw createError('NOT_FOUND', '主机组不存在', '请检查hostGroupId是否正确');
    }

    return result.rows[0];
  }

  static async listHostGroups(
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ hostGroups: HostGroup[]; total: number }> {
    const [groupsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM host_groups WHERE is_deleted = false 
         ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [pageSize, (page - 1) * pageSize]
      ),
      pool.query(`SELECT COUNT(*) FROM host_groups WHERE is_deleted = false`)
    ]);

    return {
      hostGroups: groupsResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  static async updateHostGroup(
    id: string,
    updates: {
      name?: string;
      description?: string;
      hosts?: HostInfo[];
    }
  ): Promise<HostGroup> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        `SELECT * FROM host_groups WHERE id = $1 AND is_deleted = false FOR UPDATE`,
        [id]
      );

      if (existingResult.rows.length === 0) {
        throw createError('NOT_FOUND', '主机组不存在', '请检查hostGroupId是否正确');
      }

      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${paramIndex}`);
        values.push(updates.name);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        fields.push(`description = $${paramIndex}`);
        values.push(updates.description);
        paramIndex++;
      }

      if (updates.hosts !== undefined) {
        fields.push(`hosts = $${paramIndex}`);
        values.push(JSON.stringify(updates.hosts));
        paramIndex++;
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);

      values.push(id);

      const result = await client.query(
        `UPDATE host_groups SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async deleteHostGroup(id: string): Promise<void> {
    const result = await pool.query(
      `UPDATE host_groups SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      throw createError('NOT_FOUND', '主机组不存在', '请检查hostGroupId是否正确');
    }
  }

  static async importCommandsFromCSV(
    records: any[],
    importedBy: string
  ): Promise<{
    importBatchId: string;
    status: ImportStatus;
    total: number;
    success: number;
    failed: number;
    errors: ImportError[];
  }> {
    const importBatchId = `IMPORT-${uuidv4().slice(0, 8).toUpperCase()}`;
    const errors: ImportError[] = [];
    let successCount = 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO import_records (import_batch_id, file_name, status, total_rows, imported_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [importBatchId, `import_${Date.now()}.csv`, ImportStatus.PROCESSING, records.length, importedBy]
      );

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNum = i + 1;

        try {
          if (!record.requestId) {
            errors.push({ row: rowNum, field: 'requestId', message: 'requestId不能为空' });
            continue;
          }
          if (!record.title) {
            errors.push({ row: rowNum, field: 'title', message: 'title不能为空' });
            continue;
          }
          if (!record.command) {
            errors.push({ row: rowNum, field: 'command', message: 'command不能为空' });
            continue;
          }
          if (!record.hostGroupId) {
            errors.push({ row: rowNum, field: 'hostGroupId', message: 'hostGroupId不能为空' });
            continue;
          }
          if (!record.executionWindowStart) {
            errors.push({ row: rowNum, field: 'executionWindowStart', message: '执行开始时间不能为空' });
            continue;
          }
          if (!record.executionWindowEnd) {
            errors.push({ row: rowNum, field: 'executionWindowEnd', message: '执行结束时间不能为空' });
            continue;
          }

          const hostGroupResult = await client.query(
            `SELECT * FROM host_groups WHERE id = $1 AND is_deleted = false`,
            [record.hostGroupId]
          );

          if (hostGroupResult.rows.length === 0) {
            errors.push({ 
              row: rowNum, 
              field: 'hostGroupId', 
              message: `主机组 ${record.hostGroupId} 不存在`,
              data: record
            });
            continue;
          }

          const existingResult = await client.query(
            `SELECT * FROM batch_commands WHERE request_id = $1`,
            [record.requestId]
          );

          if (existingResult.rows.length > 0) {
            errors.push({ 
              row: rowNum, 
              field: 'requestId', 
              message: `requestId ${record.requestId} 已存在`,
              data: record
            });
            continue;
          }

          const hostGroup = hostGroupResult.rows[0];
          const totalHosts = hostGroup.hosts.length;

          await client.query(
            `INSERT INTO batch_commands (
              request_id, title, command, host_group_id,
              execution_window_start, execution_window_end,
              submitter_id, submitter_name, required_approval_count,
              total_hosts, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              record.requestId,
              record.title,
              record.command,
              record.hostGroupId,
              new Date(record.executionWindowStart),
              new Date(record.executionWindowEnd),
              importedBy,
              record.submitterName || 'Imported User',
              record.requiredApprovalCount || 1,
              totalHosts,
              'PENDING_APPROVAL'
            ]
          );

          successCount++;
        } catch (error: any) {
          errors.push({ 
            row: rowNum, 
            message: `处理失败: ${error.message}`,
            data: record
          });
        }
      }

      const finalStatus = errors.length === 0 ? ImportStatus.SUCCESS :
                         successCount === 0 ? ImportStatus.FAILED : ImportStatus.PARTIAL_SUCCESS;

      await client.query(
        `UPDATE import_records 
         SET status = $1, success_rows = $2, failed_rows = $3, error_details = $4, completed_at = CURRENT_TIMESTAMP
         WHERE import_batch_id = $5`,
        [finalStatus, successCount, errors.length, JSON.stringify(errors), importBatchId]
      );

      await client.query('COMMIT');

      return {
        importBatchId,
        status: finalStatus,
        total: records.length,
        success: successCount,
        failed: errors.length,
        errors
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getImportRecord(importBatchId: string): Promise<any> {
    const result = await pool.query(
      `SELECT * FROM import_records WHERE import_batch_id = $1`,
      [importBatchId]
    );

    if (result.rows.length === 0) {
      throw createError('NOT_FOUND', '导入记录不存在', '请检查importBatchId是否正确');
    }

    return result.rows[0];
  }
}
