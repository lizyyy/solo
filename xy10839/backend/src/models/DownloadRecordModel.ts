import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { DownloadRecord } from '../types';

export class DownloadRecordModel {
  static findByTaskId(taskId: string): DownloadRecord[] {
    return db.prepare('SELECT * FROM download_records WHERE taskId = ? ORDER BY downloadedAt DESC').all(taskId) as DownloadRecord[];
  }

  static findByToken(token: string): DownloadRecord | null {
    return db.prepare('SELECT * FROM download_records WHERE downloadToken = ?').get(token) as DownloadRecord || null;
  }

  static create(data: Omit<DownloadRecord, 'id'>): DownloadRecord {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO download_records (id, taskId, downloadToken, downloadedBy, downloadedAt, clientIp, userAgent, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.taskId,
      data.downloadToken,
      data.downloadedBy,
      data.downloadedAt,
      data.clientIp,
      data.userAgent,
      data.expiresAt
    );
    return db.prepare('SELECT * FROM download_records WHERE id = ?').get(id) as DownloadRecord;
  }
}
