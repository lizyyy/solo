import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './schema';
import {
  QueueAdjustment,
  AffectedTask,
  FailureRecord,
  AdjustmentStatus,
  PriorityLevel,
  CreateAdjustmentRequest
} from '../types';

const serializeDate = (date: Date): string => date.toISOString();
const deserializeDate = (str: string): Date => new Date(str);
const serializeJson = (obj: any): string => JSON.stringify(obj);
const deserializeJson = (str: string): any => JSON.parse(str);

export const QueueAdjustmentDAO = {
  async create(request: CreateAdjustmentRequest, originalPriority: PriorityLevel): Promise<QueueAdjustment> {
    const db = getDatabase();
    const now = new Date();
    const id = uuidv4();
    
    const adjustment: QueueAdjustment = {
      id,
      idempotencyKey: request.idempotencyKey,
      queueName: request.queueName,
      originalPriority,
      targetPriority: request.targetPriority,
      reason: request.reason,
      status: AdjustmentStatus.PENDING,
      recoveryCondition: request.recoveryCondition,
      scheduledAt: request.scheduledAt || now,
      createdBy: request.createdBy,
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO queue_adjustments (
          id, idempotency_key, queue_name, original_priority, target_priority,
          reason, status, recovery_condition, scheduled_at, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          adjustment.id,
          adjustment.idempotencyKey,
          adjustment.queueName,
          adjustment.originalPriority,
          adjustment.targetPriority,
          adjustment.reason,
          adjustment.status,
          adjustment.recoveryCondition,
          serializeDate(adjustment.scheduledAt),
          adjustment.createdBy,
          serializeDate(adjustment.createdAt),
          serializeDate(adjustment.updatedAt)
        ],
        function(err) {
          if (err) reject(err);
          else resolve(adjustment);
        }
      );
    });
  },

  async findByIdempotencyKey(key: string): Promise<QueueAdjustment | null> {
    const db = getDatabase();
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM queue_adjustments WHERE idempotency_key = ?', [key], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRowToAdjustment(row));
      });
    });
  },

  async findById(id: string): Promise<QueueAdjustment | null> {
    const db = getDatabase();
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM queue_adjustments WHERE id = ?', [id], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRowToAdjustment(row));
      });
    });
  },

  async findAll(filters?: { status?: AdjustmentStatus; queueName?: string }): Promise<QueueAdjustment[]> {
    const db = getDatabase();
    let query = 'SELECT * FROM queue_adjustments WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.queueName) {
      query += ' AND queue_name = ?';
      params.push(filters.queueName);
    }
    query += ' ORDER BY created_at DESC';

    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRowToAdjustment(row)));
      });
    });
  },

  async updateStatus(id: string, status: AdjustmentStatus, additionalFields?: Partial<QueueAdjustment>): Promise<void> {
    const db = getDatabase();
    const now = new Date();
    let query = 'UPDATE queue_adjustments SET status = ?, updated_at = ?';
    const params: any[] = [status, serializeDate(now)];

    if (additionalFields) {
      if (additionalFields.activatedAt) {
        query += ', activated_at = ?';
        params.push(serializeDate(additionalFields.activatedAt));
      }
      if (additionalFields.restoredAt) {
        query += ', restored_at = ?';
        params.push(serializeDate(additionalFields.restoredAt));
      }
      if (additionalFields.completedAt) {
        query += ', completed_at = ?';
        params.push(serializeDate(additionalFields.completedAt));
      }
      if (additionalFields.report) {
        query += ', report = ?';
        params.push(serializeJson(additionalFields.report));
      }
    }

    query += ' WHERE id = ?';
    params.push(id);

    return new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  async updateManualCorrection(id: string, fields: { targetPriority?: PriorityLevel; recoveryCondition?: string }): Promise<void> {
    const db = getDatabase();
    const now = new Date();
    let query = 'UPDATE queue_adjustments SET updated_at = ?';
    const params: any[] = [serializeDate(now)];

    if (fields.targetPriority !== undefined) {
      query += ', target_priority = ?';
      params.push(fields.targetPriority);
    }
    if (fields.recoveryCondition !== undefined) {
      query += ', recovery_condition = ?';
      params.push(fields.recoveryCondition);
    }

    query += ' WHERE id = ?';
    params.push(id);

    return new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  mapRowToAdjustment(row: any): QueueAdjustment {
    return {
      id: row.id,
      idempotencyKey: row.idempotency_key,
      queueName: row.queue_name,
      originalPriority: row.original_priority,
      targetPriority: row.target_priority,
      reason: row.reason,
      status: row.status,
      recoveryCondition: row.recovery_condition,
      scheduledAt: deserializeDate(row.scheduled_at),
      activatedAt: row.activated_at ? deserializeDate(row.activated_at) : undefined,
      restoredAt: row.restored_at ? deserializeDate(row.restored_at) : undefined,
      completedAt: row.completed_at ? deserializeDate(row.completed_at) : undefined,
      createdBy: row.created_by,
      createdAt: deserializeDate(row.created_at),
      updatedAt: deserializeDate(row.updated_at),
      report: row.report ? deserializeJson(row.report) : undefined
    };
  }
};

export const AffectedTaskDAO = {
  async create(task: Omit<AffectedTask, 'id'>): Promise<AffectedTask> {
    const db = getDatabase();
    const id = uuidv4();
    const fullTask: AffectedTask = { ...task, id } as AffectedTask;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO affected_tasks (
          id, adjustment_id, task_id, task_type, original_priority, 
          adjusted_priority, affected_at, recovered_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullTask.id,
          fullTask.adjustmentId,
          fullTask.taskId,
          fullTask.taskType,
          fullTask.originalPriority,
          fullTask.adjustedPriority,
          serializeDate(fullTask.affectedAt),
          fullTask.recoveredAt ? serializeDate(fullTask.recoveredAt) : null,
          fullTask.metadata ? serializeJson(fullTask.metadata) : null
        ],
        function(err) {
          if (err) reject(err);
          else resolve(fullTask);
        }
      );
    });
  },

  async findByAdjustmentId(adjustmentId: string): Promise<AffectedTask[]> {
    const db = getDatabase();
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM affected_tasks WHERE adjustment_id = ?', [adjustmentId], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRowToTask(row)));
      });
    });
  },

  async markRecovered(taskId: string): Promise<void> {
    const db = getDatabase();
    const now = new Date();
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE affected_tasks SET recovered_at = ? WHERE id = ?',
        [serializeDate(now), taskId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  mapRowToTask(row: any): AffectedTask {
    return {
      id: row.id,
      adjustmentId: row.adjustment_id,
      taskId: row.task_id,
      taskType: row.task_type,
      originalPriority: row.original_priority,
      adjustedPriority: row.adjusted_priority,
      affectedAt: deserializeDate(row.affected_at),
      recoveredAt: row.recovered_at ? deserializeDate(row.recovered_at) : undefined,
      metadata: row.metadata ? deserializeJson(row.metadata) : {}
    };
  }
};

export const FailureRecordDAO = {
  async create(record: Omit<FailureRecord, 'id' | 'createdAt'>): Promise<FailureRecord> {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date();
    const fullRecord: FailureRecord = { ...record, id, createdAt: now } as FailureRecord;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO failure_records (
          id, adjustment_id, operation, original_input, processing_basis,
          error_message, error_stack, final_conclusion, resolved_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullRecord.id,
          fullRecord.adjustmentId,
          fullRecord.operation,
          serializeJson(fullRecord.originalInput),
          fullRecord.processingBasis,
          fullRecord.errorMessage,
          fullRecord.errorStack || null,
          fullRecord.finalConclusion || null,
          fullRecord.resolvedAt ? serializeDate(fullRecord.resolvedAt) : null,
          serializeDate(fullRecord.createdAt)
        ],
        function(err) {
          if (err) reject(err);
          else resolve(fullRecord);
        }
      );
    });
  },

  async findByAdjustmentId(adjustmentId: string): Promise<FailureRecord[]> {
    const db = getDatabase();
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM failure_records WHERE adjustment_id = ?', [adjustmentId], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRowToRecord(row)));
      });
    });
  },

  async resolve(id: string, finalConclusion: string): Promise<void> {
    const db = getDatabase();
    const now = new Date();
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE failure_records SET final_conclusion = ?, resolved_at = ? WHERE id = ?',
        [finalConclusion, serializeDate(now), id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  mapRowToRecord(row: any): FailureRecord {
    return {
      id: row.id,
      adjustmentId: row.adjustment_id,
      operation: row.operation,
      originalInput: deserializeJson(row.original_input),
      processingBasis: row.processing_basis,
      errorMessage: row.error_message,
      errorStack: row.error_stack || undefined,
      finalConclusion: row.final_conclusion || undefined,
      resolvedAt: row.resolved_at ? deserializeDate(row.resolved_at) : undefined,
      createdAt: deserializeDate(row.created_at)
    };
  }
};
