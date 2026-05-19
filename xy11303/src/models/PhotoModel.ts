import { getDb, generateId, now } from './database';
import { Photo } from '../types';

export class PhotoModel {
  static create(data: Omit<Photo, 'id' | 'uploadedAt' | 'isApproved'>): Photo {
    const db = getDb();
    const id = generateId();
    const uploadedAt = now();
    const isApproved = false;
    
    const stmt = db.prepare(`
      INSERT INTO photos (id, task_id, uploader_id, photo_type, photo_url, thumbnail_url,
        file_name, file_size, uploaded_at, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, data.taskId, data.uploaderId, data.photoType, data.photoUrl, data.thumbnailUrl,
      data.fileName, data.fileSize, uploadedAt, isApproved ? 1 : 0);
    
    return this.getById(id)!;
  }

  static getById(id: string): Photo | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getByTaskId(taskId: string): Photo[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM photos WHERE task_id = ? ORDER BY uploaded_at').all(taskId) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static countByTaskId(taskId: string): number {
    const db = getDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM photos WHERE task_id = ?').get(taskId) as any;
    return result.count;
  }

  static approve(id: string): Photo | null {
    const db = getDb();
    db.prepare('UPDATE photos SET is_approved = 1, approved_at = ? WHERE id = ?').run(now(), id);
    return this.getById(id);
  }

  private static mapRow(row: any): Photo {
    return {
      id: row.id,
      taskId: row.task_id,
      uploaderId: row.uploader_id,
      photoType: row.photo_type,
      photoUrl: row.photo_url,
      thumbnailUrl: row.thumbnail_url,
      fileName: row.file_name,
      fileSize: row.file_size,
      uploadedAt: row.uploaded_at,
      isApproved: row.is_approved === 1,
      approvedAt: row.approved_at
    };
  }
}
