import { v4 as uuidv4 } from 'uuid';
import { getDatabase, runSync, getSync, allSync } from '../database';
import { PhotoItem } from '../types';

export class PhotoItemRepository {
  private get db() {
    return getDatabase();
  }

  async create(data: {
    batchId: string;
    photoNo: string;
    category: string;
    name: string;
    url: string;
    thumbnail?: string | null;
    uploadedBy: string;
    uploadedAt: number;
    isAbnormal: boolean;
    abnormalDesc?: string | null;
  }): Promise<PhotoItem> {
    const now = Date.now();
    const id = uuidv4();
    await runSync(this.db, `
      INSERT INTO photo_items (
        id, batch_id, photo_no, category, name, url, thumbnail,
        uploaded_by, uploaded_at, is_abnormal, abnormal_desc, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.batchId,
      data.photoNo,
      data.category,
      data.name,
      data.url,
      data.thumbnail || null,
      data.uploadedBy,
      data.uploadedAt,
      data.isAbnormal ? 1 : 0,
      data.abnormalDesc || null,
      'pending',
      now
    ]);
    return this.findById(id) as Promise<PhotoItem>;
  }

  async findById(id: string): Promise<PhotoItem | null> {
    const row = await getSync(this.db, 'SELECT * FROM photo_items WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async findByBatchId(batchId: string): Promise<PhotoItem[]> {
    const rows = await allSync(this.db, 'SELECT * FROM photo_items WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
    return rows.map(row => this.mapRow(row));
  }

  async findAbnormalByBatchId(batchId: string): Promise<PhotoItem[]> {
    const rows = await allSync(this.db, 'SELECT * FROM photo_items WHERE batch_id = ? AND is_abnormal = 1 ORDER BY created_at DESC', [batchId]);
    return rows.map(row => this.mapRow(row));
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await runSync(this.db, 'UPDATE photo_items SET status = ? WHERE id = ?', [status, id]);
  }

  async deleteByBatchId(batchId: string): Promise<void> {
    await runSync(this.db, 'DELETE FROM photo_items WHERE batch_id = ?', [batchId]);
  }

  private mapRow(row: any): PhotoItem {
    return {
      id: row.id,
      batchId: row.batch_id,
      photoNo: row.photo_no,
      category: row.category,
      name: row.name,
      url: row.url,
      thumbnail: row.thumbnail,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
      isAbnormal: row.is_abnormal === 1,
      abnormalDesc: row.abnormal_desc,
      status: row.status,
      createdAt: row.created_at
    };
  }
}
