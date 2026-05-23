import { v4 as uuidv4 } from 'uuid';
import { getDatabase, runSync, getSync, allSync } from '../database';
import { Batch, BatchStatus, IdempotentStrategy } from '../types';

export class BatchRepository {
  private get db() {
    return getDatabase();
  }

  async create(data: {
    batchNo: string;
    vin: string;
    plateNumber: string;
    responsiblePerson: string;
    idempotentStrategy: IdempotentStrategy;
    createdBy: string;
  }): Promise<Batch> {
    const now = Date.now();
    const id = uuidv4();
    const sql = `
      INSERT INTO batches (
        id, batch_no, vin, plate_number, responsible_person, status,
        idempotent_strategy, frozen, submit_count, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await runSync(this.db, sql, [
      id,
      data.batchNo,
      data.vin,
      data.plateNumber,
      data.responsiblePerson,
      BatchStatus.DRAFT,
      data.idempotentStrategy,
      0,
      0,
      now,
      now,
      data.createdBy
    ]);
    return this.findById(id) as Promise<Batch>;
  }

  async findById(id: string): Promise<Batch | null> {
    const row = await getSync(this.db, 'SELECT * FROM batches WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async findByBatchNo(batchNo: string): Promise<Batch | null> {
    const row = await getSync(this.db, 'SELECT * FROM batches WHERE batch_no = ?', [batchNo]);
    return row ? this.mapRow(row) : null;
  }

  async findByVin(vin: string): Promise<Batch[]> {
    const rows = await allSync(this.db, 'SELECT * FROM batches WHERE vin = ? ORDER BY created_at DESC', [vin]);
    return rows.map(row => this.mapRow(row));
  }

  async findByStatus(status: BatchStatus): Promise<Batch[]> {
    const rows = await allSync(this.db, 'SELECT * FROM batches WHERE status = ? ORDER BY created_at DESC', [status]);
    return rows.map(row => this.mapRow(row));
  }

  async findAll(): Promise<Batch[]> {
    const rows = await allSync(this.db, 'SELECT * FROM batches ORDER BY created_at DESC');
    return rows.map(row => this.mapRow(row));
  }

  async updateStatus(id: string, status: BatchStatus): Promise<void> {
    const now = Date.now();
    await runSync(this.db, 'UPDATE batches SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
  }

  async incrementSubmitCount(id: string): Promise<void> {
    const now = Date.now();
    await runSync(this.db, `
      UPDATE batches 
      SET submit_count = submit_count + 1, last_submitted_at = ?, updated_at = ? 
      WHERE id = ?
    `, [now, now, id]);
  }

  async freeze(id: string, frozenBy: string): Promise<void> {
    const now = Date.now();
    await runSync(this.db, `
      UPDATE batches 
      SET frozen = 1, frozen_at = ?, frozen_by = ?, status = ?, updated_at = ? 
      WHERE id = ?
    `, [now, frozenBy, BatchStatus.FROZEN, now, id]);
  }

  async unfreeze(id: string): Promise<void> {
    const now = Date.now();
    await runSync(this.db, `
      UPDATE batches 
      SET frozen = 0, frozen_at = NULL, frozen_by = NULL, updated_at = ? 
      WHERE id = ?
    `, [now, id]);
  }

  async updateStrategy(id: string, strategy: IdempotentStrategy): Promise<void> {
    const now = Date.now();
    await runSync(this.db, 'UPDATE batches SET idempotent_strategy = ?, updated_at = ? WHERE id = ?', [strategy, now, id]);
  }

  async delete(id: string): Promise<void> {
    await runSync(this.db, 'DELETE FROM batches WHERE id = ?', [id]);
  }

  private mapRow(row: any): Batch {
    return {
      id: row.id,
      batchNo: row.batch_no,
      vin: row.vin,
      plateNumber: row.plate_number,
      responsiblePerson: row.responsible_person,
      status: row.status as BatchStatus,
      idempotentStrategy: row.idempotent_strategy as IdempotentStrategy,
      frozen: row.frozen === 1,
      frozenAt: row.frozen_at,
      frozenBy: row.frozen_by,
      submitCount: row.submit_count,
      lastSubmittedAt: row.last_submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by
    };
  }
}
