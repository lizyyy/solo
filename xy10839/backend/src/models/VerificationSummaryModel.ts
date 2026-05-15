import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { VerificationSummary } from '../types';

export class VerificationSummaryModel {
  static findByTaskId(taskId: string): VerificationSummary | null {
    const row = db.prepare('SELECT * FROM verification_summaries WHERE taskId = ?').get(taskId) as any;
    if (!row) return null;
    return {
      ...row,
      metadata: JSON.parse(row.metadata),
      isValid: Boolean(row.isValid)
    };
  }

  static create(data: Omit<VerificationSummary, 'id'>): VerificationSummary {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO verification_summaries (id, taskId, totalFiles, totalSize, checksum, algorithm, metadata, verifiedAt, isValid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.taskId,
      data.totalFiles,
      data.totalSize,
      data.checksum,
      data.algorithm,
      JSON.stringify(data.metadata),
      data.verifiedAt,
      data.isValid ? 1 : 0
    );
    return this.findByTaskId(data.taskId)!;
  }
}
