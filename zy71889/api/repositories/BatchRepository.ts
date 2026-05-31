import { getDb } from '../db/database.js';
import type { ExperimentBatch } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class BatchRepository {
  private db = getDb();

  findAll(): ExperimentBatch[] {
    const rows = this.db
      .prepare('SELECT * FROM experiment_batches ORDER BY created_at DESC')
      .all() as any[];
    return rows.map(this.mapRowToBatch);
  }

  findById(id: string): ExperimentBatch | null {
    const row = this.db
      .prepare('SELECT * FROM experiment_batches WHERE id = ?')
      .get(id) as any;
    return row ? this.mapRowToBatch(row) : null;
  }

  findByMaterialAndStudent(materialId: string, studentId: string): ExperimentBatch[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM experiment_batches WHERE material_id = ? AND student_id = ? ORDER BY version ASC'
      )
      .all(materialId, studentId) as any[];
    return rows.map(this.mapRowToBatch);
  }

  create(data: {
    materialId: string;
    studentId: string;
    studentName: string;
    status?: ExperimentBatch['status'];
    version?: number;
    parentBatchId?: string;
  }): ExperimentBatch {
    const id = uuidv4();
    const now = new Date().toISOString();
    const status = data.status || 'pending';
    const version = data.version || 1;

    this.db
      .prepare(
        `INSERT INTO experiment_batches (id, material_id, student_id, student_name, created_at, status, version, parent_batch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.materialId,
        data.studentId,
        data.studentName,
        now,
        status,
        version,
        data.parentBatchId || null
      );

    return this.findById(id)!;
  }

  updateStatus(id: string, status: ExperimentBatch['status']): ExperimentBatch | null {
    this.db
      .prepare('UPDATE experiment_batches SET status = ? WHERE id = ?')
      .run(status, id);
    return this.findById(id);
  }

  getVersionCount(materialId: string, studentId: string): number {
    const result = this.db
      .prepare(
        'SELECT COUNT(*) as count FROM experiment_batches WHERE material_id = ? AND student_id = ?'
      )
      .get(materialId, studentId) as { count: number };
    return result.count;
  }

  private mapRowToBatch(row: any): ExperimentBatch {
    return {
      id: row.id,
      materialId: row.material_id,
      studentId: row.student_id,
      studentName: row.student_name,
      createdAt: row.created_at,
      status: row.status,
      version: row.version,
      parentBatchId: row.parent_batch_id || undefined,
    };
  }
}
