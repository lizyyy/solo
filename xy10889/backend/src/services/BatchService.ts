import { Batch } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { runInsert, runQuery, runGet } from '../database';

export class BatchService {
  static async createBatch(data: Omit<Batch, 'id' | 'status' | 'sampleCount' | 'createdAt'>): Promise<Batch> {
    const existing = await runGet('SELECT id FROM batches WHERE batchNumber = ?', [data.batchNumber]);
    if (existing) {
      throw new Error(`批次号 ${data.batchNumber} 已存在`);
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const batch: Batch = {
      ...data,
      id,
      status: 'PREPARING',
      sampleCount: 0,
      createdAt: now
    };

    await runInsert(
      `INSERT INTO batches (id, batchNumber, status, origin, destination, estimatedArrival, courier, sampleCount, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, batch.batchNumber, batch.status, batch.origin, batch.destination, batch.estimatedArrival || null, batch.courier, batch.sampleCount, batch.createdAt]
    );

    return batch;
  }

  static async getBatchById(id: string): Promise<Batch | null> {
    return runGet('SELECT * FROM batches WHERE id = ?', [id]);
  }

  static async getBatchByNumber(batchNumber: string): Promise<Batch | null> {
    return runGet('SELECT * FROM batches WHERE batchNumber = ?', [batchNumber]);
  }

  static async getAllBatches(filters?: { status?: string }): Promise<Batch[]> {
    let sql = 'SELECT * FROM batches WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    sql += ' ORDER BY createdAt DESC';

    return runQuery(sql, params);
  }

  static async updateBatchStatus(id: string, status: Batch['status']): Promise<Batch> {
    const batch = await this.getBatchById(id);
    if (!batch) {
      throw new Error('批次不存在');
    }

    const updates: string[] = ['status = ?'];
    const params: any[] = [status];

    if (status === 'DELIVERED') {
      const now = new Date().toISOString();
      updates.push('actualArrival = ?');
      params.push(now);
    }

    params.push(id);
    await runInsert(`UPDATE batches SET ${updates.join(', ')} WHERE id = ?`, params);

    return { ...batch, status };
  }

  static async addSampleToBatch(batchId: string, sampleId: string): Promise<void> {
    const batch = await this.getBatchById(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    await runInsert('UPDATE samples SET batchId = ? WHERE id = ?', [batchId, sampleId]);
    await runInsert('UPDATE batches SET sampleCount = sampleCount + 1 WHERE id = ?', [batchId]);
  }

  static async removeSampleFromBatch(batchId: string, sampleId: string): Promise<void> {
    await runInsert('UPDATE samples SET batchId = NULL WHERE id = ?', [sampleId]);
    await runInsert('UPDATE batches SET sampleCount = sampleCount - 1 WHERE id = ? AND sampleCount > 0', [batchId]);
  }

  static async getBatchSamples(batchId: string): Promise<any[]> {
    return runQuery('SELECT * FROM samples WHERE batchId = ? ORDER BY createdAt DESC', [batchId]);
  }
}
