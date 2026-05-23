import { v4 as uuidv4 } from 'uuid';
import { getDatabase, runSync, getSync, allSync } from '../database';
import { SmsScreenshot } from '../types';

export class SmsScreenshotRepository {
  private get db() {
    return getDatabase();
  }

  async create(data: {
    batchId: string;
    smsNo: string;
    sender: string;
    receiver: string;
    content: string;
    sentAt: number;
    url: string;
    uploadedBy: string;
    uploadedAt: number;
  }): Promise<SmsScreenshot> {
    const now = Date.now();
    const id = uuidv4();
    await runSync(this.db, `
      INSERT INTO sms_screenshots (
        id, batch_id, sms_no, sender, receiver, content,
        sent_at, url, uploaded_by, uploaded_at, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.batchId,
      data.smsNo,
      data.sender,
      data.receiver,
      data.content,
      data.sentAt,
      data.url,
      data.uploadedBy,
      data.uploadedAt,
      'pending',
      now
    ]);
    return this.findById(id) as Promise<SmsScreenshot>;
  }

  async findById(id: string): Promise<SmsScreenshot | null> {
    const row = await getSync(this.db, 'SELECT * FROM sms_screenshots WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async findByBatchId(batchId: string): Promise<SmsScreenshot[]> {
    const rows = await allSync(this.db, 'SELECT * FROM sms_screenshots WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
    return rows.map(row => this.mapRow(row));
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await runSync(this.db, 'UPDATE sms_screenshots SET status = ? WHERE id = ?', [status, id]);
  }

  async deleteByBatchId(batchId: string): Promise<void> {
    await runSync(this.db, 'DELETE FROM sms_screenshots WHERE batch_id = ?', [batchId]);
  }

  private mapRow(row: any): SmsScreenshot {
    return {
      id: row.id,
      batchId: row.batch_id,
      smsNo: row.sms_no,
      sender: row.sender,
      receiver: row.receiver,
      content: row.content,
      sentAt: row.sent_at,
      url: row.url,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
      status: row.status,
      createdAt: row.created_at
    };
  }
}
