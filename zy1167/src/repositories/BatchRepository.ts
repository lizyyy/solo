import { db } from '../database';
import { Batch, BatchId, BatchStatus } from '../types';
import { generateUUID } from '../utils/idempotency';

export class BatchRepository {
  private static instance: BatchRepository | null = null;

  private constructor() {}

  public static getInstance(): BatchRepository {
    if (!BatchRepository.instance) {
      BatchRepository.instance = new BatchRepository();
    }
    return BatchRepository.instance;
  }

  public async create(batchData: {
    name: string;
    description?: string;
    year: number;
    month: number;
    totalRecords: number;
    totalAmount: number;
    concurrency?: number;
    rateLimit?: number;
    chunkSize?: number;
  }): Promise<Batch> {
    const id = generateUUID();
    const now = new Date();
    
    await db.run(
      `
      INSERT INTO batches (
        id, name, description, year, month, total_records, total_amount,
        processed_records, success_records, failed_records, status,
        concurrency, rate_limit, chunk_size, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        batchData.name,
        batchData.description || null,
        batchData.year,
        batchData.month,
        batchData.totalRecords,
        batchData.totalAmount,
        BatchStatus.PENDING,
        batchData.concurrency ?? 10,
        batchData.rateLimit ?? 100,
        batchData.chunkSize ?? 100,
        now.toISOString(),
        now.toISOString()
      ]
    );

    return this.findById(id) as Promise<Batch>;
  }

  public async findById(id: BatchId): Promise<Batch | undefined> {
    const row = await db.get(
      'SELECT * FROM batches WHERE id = ?',
      [id]
    );
    return row ? this.mapRowToBatch(row) : undefined;
  }

  public async findByMonth(year: number, month: number): Promise<Batch[]> {
    const rows = await db.all(
      'SELECT * FROM batches WHERE year = ? AND month = ? ORDER BY created_at DESC',
      [year, month]
    );
    return rows.map(row => this.mapRowToBatch(row));
  }

  public async findByStatus(status: BatchStatus): Promise<Batch[]> {
    const rows = await db.all(
      'SELECT * FROM batches WHERE status = ? ORDER BY created_at DESC',
      [status]
    );
    return rows.map(row => this.mapRowToBatch(row));
  }

  public async findAll(page: number = 1, pageSize: number = 20): Promise<{ batches: Batch[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    const [countResult, rows] = await Promise.all([
      db.get<{ count: number }>('SELECT COUNT(*) as count FROM batches'),
      db.all(
        'SELECT * FROM batches ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [pageSize, offset]
      )
    ]);

    return {
      batches: rows.map(row => this.mapRowToBatch(row)),
      total: countResult?.count || 0
    };
  }

  public async update(id: BatchId, updates: Partial<Omit<Batch, 'id' | 'createdAt'>>): Promise<Batch | undefined> {
    const now = new Date();
    const fields: string[] = ['updated_at = ?'];
    const values: any[] = [now.toISOString()];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.processedRecords !== undefined) {
      fields.push('processed_records = ?');
      values.push(updates.processedRecords);
    }
    if (updates.successRecords !== undefined) {
      fields.push('success_records = ?');
      values.push(updates.successRecords);
    }
    if (updates.failedRecords !== undefined) {
      fields.push('failed_records = ?');
      values.push(updates.failedRecords);
    }
    if (updates.startedAt !== undefined) {
      fields.push('started_at = ?');
      values.push(updates.startedAt ? updates.startedAt.toISOString() : null);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt ? updates.completedAt.toISOString() : null);
    }
    if (updates.failedAt !== undefined) {
      fields.push('failed_at = ?');
      values.push(updates.failedAt ? updates.failedAt.toISOString() : null);
    }
    if (updates.pausedAt !== undefined) {
      fields.push('paused_at = ?');
      values.push(updates.pausedAt ? updates.pausedAt.toISOString() : null);
    }

    values.push(id);

    await db.run(
      `UPDATE batches SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  public async updateStatus(id: BatchId, status: BatchStatus): Promise<Batch | undefined> {
    const updates: Partial<Omit<Batch, 'id' | 'createdAt'>> = { status };
    const now = new Date();

    switch (status) {
      case BatchStatus.RUNNING:
        updates.startedAt = now;
        updates.pausedAt = null;
        break;
      case BatchStatus.COMPLETED:
        updates.completedAt = now;
        break;
      case BatchStatus.FAILED:
        updates.failedAt = now;
        break;
      case BatchStatus.PAUSED:
        updates.pausedAt = now;
        break;
    }

    return this.update(id, updates);
  }

  public async incrementProgress(
    id: BatchId,
    success: boolean
  ): Promise<Batch | undefined> {
    const batch = await this.findById(id);
    if (!batch) {
      return undefined;
    }

    const processedRecords = batch.processedRecords + 1;
    const successRecords = success ? batch.successRecords + 1 : batch.successRecords;
    const failedRecords = success ? batch.failedRecords : batch.failedRecords + 1;

    return this.update(id, {
      processedRecords,
      successRecords,
      failedRecords
    });
  }

  public async delete(id: BatchId): Promise<boolean> {
    const result = await db.run(
      'DELETE FROM batches WHERE id = ?',
      [id]
    );
    return result.changes > 0;
  }

  public async count(): Promise<number> {
    const result = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM batches');
    return result?.count || 0;
  }

  private mapRowToBatch(row: any): Batch {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      year: row.year,
      month: row.month,
      totalRecords: row.total_records,
      totalAmount: row.total_amount,
      processedRecords: row.processed_records,
      successRecords: row.success_records,
      failedRecords: row.failed_records,
      status: row.status as BatchStatus,
      concurrency: row.concurrency,
      rateLimit: row.rate_limit,
      chunkSize: row.chunk_size,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      failedAt: row.failed_at ? new Date(row.failed_at) : null,
      pausedAt: row.paused_at ? new Date(row.paused_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

export const batchRepository = BatchRepository.getInstance();
