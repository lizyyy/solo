import { v4 as uuidv4 } from 'uuid';
import { getDatabase, runSync, getSync, allSync } from '../database';
import { AbnormalPhoto } from '../types';

export class AbnormalPhotoRepository {
  private get db() {
    return getDatabase();
  }

  async create(data: {
    batchId: string;
    photoItemId: string;
    abnormalType: string;
    description: string;
    severity: string;
    reportedBy: string;
    reportedAt: number;
  }): Promise<AbnormalPhoto> {
    const now = Date.now();
    const id = uuidv4();
    await runSync(this.db, `
      INSERT INTO abnormal_photos (
        id, batch_id, photo_item_id, abnormal_type, description, severity,
        reported_by, reported_at, reviewed, manual_override, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.batchId,
      data.photoItemId,
      data.abnormalType,
      data.description,
      data.severity,
      data.reportedBy,
      data.reportedAt,
      0,
      0,
      now,
      now
    ]);
    return this.findById(id) as Promise<AbnormalPhoto>;
  }

  async findById(id: string): Promise<AbnormalPhoto | null> {
    const row = await getSync(this.db, 'SELECT * FROM abnormal_photos WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async findByBatchId(batchId: string): Promise<AbnormalPhoto[]> {
    const rows = await allSync(this.db, 'SELECT * FROM abnormal_photos WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
    return rows.map(row => this.mapRow(row));
  }

  async findUnreviewedByBatchId(batchId: string): Promise<AbnormalPhoto[]> {
    const rows = await allSync(this.db, 'SELECT * FROM abnormal_photos WHERE batch_id = ? AND reviewed = 0 ORDER BY created_at DESC', [batchId]);
    return rows.map(row => this.mapRow(row));
  }

  async review(id: string, reviewedBy: string, reviewResult: string): Promise<void> {
    const now = Date.now();
    await runSync(this.db, `
      UPDATE abnormal_photos 
      SET reviewed = 1, reviewed_by = ?, reviewed_at = ?, review_result = ?, updated_at = ?
      WHERE id = ?
    `, [reviewedBy, now, reviewResult, now, id]);
  }

  async manualOverride(id: string, overrideBy: string): Promise<void> {
    const now = Date.now();
    await runSync(this.db, `
      UPDATE abnormal_photos 
      SET manual_override = 1, manual_override_by = ?, manual_override_at = ?, updated_at = ?
      WHERE id = ?
    `, [overrideBy, now, now, id]);
  }

  async deleteByBatchId(batchId: string): Promise<void> {
    await runSync(this.db, 'DELETE FROM abnormal_photos WHERE batch_id = ?', [batchId]);
  }

  private mapRow(row: any): AbnormalPhoto {
    return {
      id: row.id,
      batchId: row.batch_id,
      photoItemId: row.photo_item_id,
      abnormalType: row.abnormal_type,
      description: row.description,
      severity: row.severity,
      reportedBy: row.reported_by,
      reportedAt: row.reported_at,
      reviewed: row.reviewed === 1,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      reviewResult: row.review_result,
      manualOverride: row.manual_override === 1,
      manualOverrideBy: row.manual_override_by,
      manualOverrideAt: row.manual_override_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
