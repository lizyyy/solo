import { db } from '../database';
import { Disbursement, DisbursementId, BatchId, PayrollId, EmployeeId, DisbursementStatus } from '../types';
import { generateUUID, generateIdempotencyKey, generateTransactionId } from '../utils/idempotency';
import { logger } from '../utils/logger';

export class DisbursementRepository {
  private static instance: DisbursementRepository | null = null;

  private constructor() {}

  public static getInstance(): DisbursementRepository {
    if (!DisbursementRepository.instance) {
      DisbursementRepository.instance = new DisbursementRepository();
    }
    return DisbursementRepository.instance;
  }

  public async create(disbursementData: {
    batchId: BatchId;
    payrollId: PayrollId;
    employeeId: EmployeeId;
    amount: number;
    maxRetries?: number;
  }): Promise<Disbursement> {
    const id = generateUUID();
    const now = new Date();
    const idempotencyKey = generateIdempotencyKey(
      disbursementData.employeeId,
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      disbursementData.batchId
    );

    await db.run(
      `
      INSERT INTO disbursements (
        id, batch_id, payroll_id, employee_id, amount, idempotency_key,
        status, retry_count, max_retries, error_message, error_code,
        external_transaction_id, processed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, NULL, NULL, ?, ?)
      `,
      [
        id,
        disbursementData.batchId,
        disbursementData.payrollId,
        disbursementData.employeeId,
        disbursementData.amount,
        idempotencyKey,
        DisbursementStatus.PENDING,
        disbursementData.maxRetries ?? 3,
        now.toISOString(),
        now.toISOString()
      ]
    );

    return this.findById(id) as Promise<Disbursement>;
  }

  public async findById(id: DisbursementId): Promise<Disbursement | undefined> {
    const row = await db.get(
      'SELECT * FROM disbursements WHERE id = ?',
      [id]
    );
    return row ? this.mapRowToDisbursement(row) : undefined;
  }

  public async findByIdempotencyKey(idempotencyKey: string): Promise<Disbursement | undefined> {
    const row = await db.get(
      'SELECT * FROM disbursements WHERE idempotency_key = ?',
      [idempotencyKey]
    );
    return row ? this.mapRowToDisbursement(row) : undefined;
  }

  public async findByBatchId(batchId: BatchId): Promise<Disbursement[]> {
    const rows = await db.all(
      'SELECT * FROM disbursements WHERE batch_id = ? ORDER BY created_at ASC',
      [batchId]
    );
    return rows.map(row => this.mapRowToDisbursement(row));
  }

  public async findByBatchIdAndStatus(batchId: BatchId, status: DisbursementStatus): Promise<Disbursement[]> {
    const rows = await db.all(
      'SELECT * FROM disbursements WHERE batch_id = ? AND status = ? ORDER BY created_at ASC',
      [batchId, status]
    );
    return rows.map(row => this.mapRowToDisbursement(row));
  }

  public async findFailedByBatchId(batchId: BatchId): Promise<Disbursement[]> {
    const rows = await db.all(
      `SELECT * FROM disbursements 
       WHERE batch_id = ? AND status = ? AND retry_count < max_retries
       ORDER BY created_at ASC`,
      [batchId, DisbursementStatus.FAILED]
    );
    return rows.map(row => this.mapRowToDisbursement(row));
  }

  public async findAll(page: number = 1, pageSize: number = 100): Promise<{ disbursements: Disbursement[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    const [countResult, rows] = await Promise.all([
      db.get<{ count: number }>('SELECT COUNT(*) as count FROM disbursements'),
      db.all(
        'SELECT * FROM disbursements ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [pageSize, offset]
      )
    ]);

    return {
      disbursements: rows.map(row => this.mapRowToDisbursement(row)),
      total: countResult?.count || 0
    };
  }

  public async update(id: DisbursementId, updates: Partial<Omit<Disbursement, 'id' | 'createdAt'>>): Promise<Disbursement | undefined> {
    const now = new Date();
    const fields: string[] = ['updated_at = ?'];
    const values: any[] = [now.toISOString()];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.retryCount !== undefined) {
      fields.push('retry_count = ?');
      values.push(updates.retryCount);
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }
    if (updates.errorCode !== undefined) {
      fields.push('error_code = ?');
      values.push(updates.errorCode);
    }
    if (updates.externalTransactionId !== undefined) {
      fields.push('external_transaction_id = ?');
      values.push(updates.externalTransactionId);
    }
    if (updates.processedAt !== undefined) {
      fields.push('processed_at = ?');
      values.push(updates.processedAt ? updates.processedAt.toISOString() : null);
    }

    values.push(id);

    await db.run(
      `UPDATE disbursements SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  public async markAsProcessing(id: DisbursementId): Promise<Disbursement | undefined> {
    return this.update(id, {
      status: DisbursementStatus.PROCESSING
    });
  }

  public async markAsSuccess(
    id: DisbursementId,
    externalTransactionId?: string
  ): Promise<Disbursement | undefined> {
    return this.update(id, {
      status: DisbursementStatus.SUCCESS,
      externalTransactionId: externalTransactionId || generateTransactionId(),
      processedAt: new Date(),
      errorMessage: null,
      errorCode: null
    });
  }

  public async markAsFailed(
    id: DisbursementId,
    errorMessage: string,
    errorCode?: string
  ): Promise<Disbursement | undefined> {
    const disbursement = await this.findById(id);
    if (!disbursement) {
      return undefined;
    }

    const newRetryCount = disbursement.retryCount + 1;
    const shouldCancel = newRetryCount >= disbursement.maxRetries;

    return this.update(id, {
      status: shouldCancel ? DisbursementStatus.CANCELLED : DisbursementStatus.FAILED,
      retryCount: newRetryCount,
      errorMessage,
      errorCode: errorCode || 'UNKNOWN_ERROR',
      processedAt: new Date()
    });
  }

  public async prepareForRetry(id: DisbursementId): Promise<Disbursement | undefined> {
    const disbursement = await this.findById(id);
    if (!disbursement) {
      return undefined;
    }

    if (disbursement.retryCount >= disbursement.maxRetries) {
      logger.warn('Disbursement has exceeded max retries', { id });
      return undefined;
    }

    return this.update(id, {
      status: DisbursementStatus.PENDING,
      errorMessage: null,
      errorCode: null
    });
  }

  public async bulkCreate(disbursementsData: {
    batchId: BatchId;
    payrollId: PayrollId;
    employeeId: EmployeeId;
    amount: number;
    maxRetries?: number;
  }[]): Promise<Disbursement[]> {
    const createdDisbursements: Disbursement[] = [];

    await db.transaction(async () => {
      for (const data of disbursementsData) {
        const idempotencyKey = generateIdempotencyKey(
          data.employeeId,
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          data.batchId
        );

        const existing = await this.findByIdempotencyKey(idempotencyKey);
        if (existing) {
          logger.warn('Disbursement already exists with same idempotency key, skipping', {
            employeeId: data.employeeId,
            batchId: data.batchId
          });
          createdDisbursements.push(existing);
          continue;
        }

        const disbursement = await this.create(data);
        createdDisbursements.push(disbursement);
      }
    });

    return createdDisbursements;
  }

  public async sumAmountByBatchId(batchId: BatchId): Promise<number> {
    const result = await db.get<{ total: number }>(
      'SELECT SUM(amount) as total FROM disbursements WHERE batch_id = ?',
      [batchId]
    );
    return result?.total || 0;
  }

  public async sumAmountByBatchIdAndStatus(batchId: BatchId, status: DisbursementStatus): Promise<number> {
    const result = await db.get<{ total: number }>(
      'SELECT SUM(amount) as total FROM disbursements WHERE batch_id = ? AND status = ?',
      [batchId, status]
    );
    return result?.total || 0;
  }

  public async countByBatchId(batchId: BatchId): Promise<number> {
    const result = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM disbursements WHERE batch_id = ?',
      [batchId]
    );
    return result?.count || 0;
  }

  public async countByBatchIdAndStatus(batchId: BatchId, status: DisbursementStatus): Promise<number> {
    const result = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM disbursements WHERE batch_id = ? AND status = ?',
      [batchId, status]
    );
    return result?.count || 0;
  }

  public async delete(id: DisbursementId): Promise<boolean> {
    const result = await db.run(
      'DELETE FROM disbursements WHERE id = ?',
      [id]
    );
    return result.changes > 0;
  }

  public async count(): Promise<number> {
    const result = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM disbursements');
    return result?.count || 0;
  }

  private mapRowToDisbursement(row: any): Disbursement {
    return {
      id: row.id,
      batchId: row.batch_id,
      payrollId: row.payroll_id,
      employeeId: row.employee_id,
      amount: row.amount,
      idempotencyKey: row.idempotency_key,
      status: row.status as DisbursementStatus,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      errorMessage: row.error_message,
      errorCode: row.error_code,
      externalTransactionId: row.external_transaction_id,
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

export const disbursementRepository = DisbursementRepository.getInstance();
