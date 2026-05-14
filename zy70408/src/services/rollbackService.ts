import { v4 as uuidv4 } from 'uuid';
import { runQuery, allQuery, getQuery } from '../database';
import { RollbackCandidate } from '../types';

export class RollbackService {
  public async generateRollbackCandidates(recordId: string): Promise<RollbackCandidate[]> {
    const failedItems = await allQuery<any>(
      `SELECT * FROM init_detail_items WHERE record_id = ? AND status = 'FAILED'`,
      [recordId]
    );

    const candidates: RollbackCandidate[] = [];

    for (const item of failedItems) {
      const candidateId = uuidv4();
      await runQuery(
        `INSERT INTO rollback_candidates (id, record_id, item_type, item_id, item_name, reason) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [candidateId, recordId, item.item_type, item.item_id, item.item_name, item.error_message]
      );

      candidates.push({
        id: candidateId,
        recordId: recordId,
        itemType: item.item_type,
        itemId: item.item_id,
        itemName: item.item_name,
        reason: item.error_message,
        createdAt: new Date()
      });
    }

    const record = await getQuery<any>(
      `SELECT tenant_id FROM tenant_init_records WHERE id = ?`,
      [recordId]
    );

    if (record) {
      const partialDevices = await allQuery<any>(
        `SELECT id, device_code, device_name FROM device_ledgers WHERE tenant_id = ? AND status = '待安装'`,
        [record.tenant_id]
      );

      for (const device of partialDevices) {
        const candidateId = uuidv4();
        await runQuery(
          `INSERT INTO rollback_candidates (id, record_id, item_type, item_id, item_name, reason) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [candidateId, recordId, 'DEVICE', device.device_code, device.device_name, '设备未完成安装']
        );

        candidates.push({
          id: candidateId,
          recordId: recordId,
          itemType: 'DEVICE',
          itemId: device.device_code,
          itemName: device.device_name,
          reason: '设备未完成安装',
          createdAt: new Date()
        });
      }
    }

    return candidates;
  }

  public async getRollbackCandidates(recordId: string): Promise<RollbackCandidate[]> {
    const rows = await allQuery<any>(
      `SELECT * FROM rollback_candidates WHERE record_id = ? ORDER BY created_at DESC`,
      [recordId]
    );

    return rows.map(row => ({
      id: row.id,
      recordId: row.record_id,
      itemType: row.item_type,
      itemId: row.item_id,
      itemName: row.item_name,
      reason: row.reason,
      createdAt: new Date(row.created_at)
    }));
  }

  public async clearRollbackCandidates(recordId: string): Promise<void> {
    await runQuery(`DELETE FROM rollback_candidates WHERE record_id = ?`, [recordId]);
  }

  public async executeRollback(recordId: string, candidateIds: string[]): Promise<{ success: boolean; rolledBack: string[] }> {
    const rolledBack: string[] = [];

    for (const candidateId of candidateIds) {
      const candidate = await getQuery<any>(
        `SELECT * FROM rollback_candidates WHERE id = ? AND record_id = ?`,
        [candidateId, recordId]
      );

      if (!candidate) continue;

      if (candidate.item_type === 'DEVICE') {
        const record = await getQuery<any>(
          `SELECT tenant_id FROM tenant_init_records WHERE id = ?`,
          [recordId]
        );

        if (record) {
          await runQuery(
            `DELETE FROM device_ledgers WHERE tenant_id = ? AND device_code = ?`,
            [record.tenant_id, candidate.item_id]
          );
        }
      }

      await runQuery(`DELETE FROM rollback_candidates WHERE id = ?`, [candidateId]);
      rolledBack.push(candidate.item_id);
    }

    return { success: true, rolledBack };
  }

  public async generateCleanupCandidates(): Promise<{
    expiredRecords: any[];
    orphanedFiles: string[];
    emptyUploads: string[];
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const expiredRecords = await allQuery<any>(
      `SELECT id, tenant_id, tenant_name, created_at, status 
       FROM tenant_init_records 
       WHERE created_at < ? AND status IN ('FAILED', 'PARTIAL_SUCCESS')
       ORDER BY created_at ASC`,
      [thirtyDaysAgo]
    );

    return {
      expiredRecords,
      orphanedFiles: [],
      emptyUploads: []
    };
  }
}

export const rollbackService = new RollbackService();
