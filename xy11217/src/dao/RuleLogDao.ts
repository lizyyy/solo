import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getQuery, allQuery } from '../database';
import { RuleLog, RuleType } from '../types';

export class RuleLogDao {
  async create(log: Omit<RuleLog, 'id' | 'processedAt'>): Promise<RuleLog> {
    const now = dayjs().toISOString();
    const id = uuidv4();
    const newLog: RuleLog = {
      ...log,
      id,
      processedAt: now
    };

    await runQuery(`
      INSERT INTO rule_logs (
        id, rule_type, record_id, record_type, store_id, batch_no,
        action, reason, details, processed_at, processed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, log.ruleType, log.recordId, log.recordType, log.storeId,
      log.batchNo || null, log.action, log.reason, log.details,
      now, log.processedBy || null
    ]);

    return newLog;
  }

  async bulkCreate(logs: Array<Omit<RuleLog, 'id' | 'processedAt'>>): Promise<RuleLog[]> {
    const now = dayjs().toISOString();
    const createdLogs: RuleLog[] = [];

    for (const log of logs) {
      const id = uuidv4();
      await runQuery(`
        INSERT INTO rule_logs (
          id, rule_type, record_id, record_type, store_id, batch_no,
          action, reason, details, processed_at, processed_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, log.ruleType, log.recordId, log.recordType, log.storeId,
        log.batchNo || null, log.action, log.reason, log.details,
        now, log.processedBy || null
      ]);
      createdLogs.push({ ...log, id, processedAt: now });
    }

    return createdLogs;
  }

  async findById(id: string): Promise<RuleLog | null> {
    const row = await getQuery('SELECT * FROM rule_logs WHERE id = ?', [id]);
    return row ? this.mapRowToLog(row as any) : null;
  }

  async findByRecordId(recordId: string, recordType: string): Promise<RuleLog[]> {
    const rows = await allQuery(`
      SELECT * FROM rule_logs 
      WHERE record_id = ? AND record_type = ?
      ORDER BY processed_at DESC
    `, [recordId, recordType]);
    return rows.map(row => this.mapRowToLog(row));
  }

  async findByRuleType(ruleType: RuleType, limit: number = 100): Promise<RuleLog[]> {
    const rows = await allQuery(`
      SELECT * FROM rule_logs 
      WHERE rule_type = ?
      ORDER BY processed_at DESC LIMIT ?
    `, [ruleType, limit]);
    return rows.map(row => this.mapRowToLog(row));
  }

  async findByStoreId(storeId: string, startDate?: string, endDate?: string): Promise<RuleLog[]> {
    let sql = 'SELECT * FROM rule_logs WHERE store_id = ?';
    const params: any[] = [storeId];

    if (startDate) {
      sql += ' AND processed_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND processed_at <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY processed_at DESC';
    const rows = await allQuery(sql, params);
    return rows.map(row => this.mapRowToLog(row));
  }

  async findByBatchNo(batchNo: string): Promise<RuleLog[]> {
    const rows = await allQuery(`
      SELECT * FROM rule_logs WHERE batch_no = ? ORDER BY processed_at DESC
    `, [batchNo]);
    return rows.map(row => this.mapRowToLog(row));
  }

  async findAll(page: number = 1, pageSize: number = 50): Promise<{ data: RuleLog[], total: number }> {
    const offset = (page - 1) * pageSize;
    
    const countResult = await getQuery<{ total: number }>(
      'SELECT COUNT(*) as total FROM rule_logs'
    );
    const total = countResult?.total || 0;

    const rows = await allQuery(`
      SELECT * FROM rule_logs ORDER BY processed_at DESC LIMIT ? OFFSET ?
    `, [pageSize, offset]);

    return {
      data: rows.map(row => this.mapRowToLog(row)),
      total
    };
  }

  private mapRowToLog(row: any): RuleLog {
    return {
      id: row.id,
      ruleType: row.rule_type as RuleType,
      recordId: row.record_id,
      recordType: row.record_type as 'sample' | 'temperature' | 'waste',
      storeId: row.store_id,
      batchNo: row.batch_no,
      action: row.action as 'block' | 'pass' | 'quarantine' | 'alert',
      reason: row.reason,
      details: row.details,
      processedAt: row.processed_at,
      processedBy: row.processed_by
    };
  }
}
