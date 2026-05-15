import { db } from '../utils/database';
import { Submission, SubmissionStatus, Attachment } from './types';

export class SubmissionDAO {
  static create(submission: Omit<Submission, 'id' | 'createdAt' | 'updatedAt'>): Submission {
    const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO submissions (id, batch_id, student_id, student_name, course_code, course_name, content, attachments, rule_version_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      submission.batchId,
      submission.studentId,
      submission.studentName,
      submission.courseCode,
      submission.courseName,
      submission.content,
      JSON.stringify(submission.attachments),
      submission.ruleVersionId,
      submission.status,
      now,
      now
    );

    return this.getById(id)!;
  }

  static getById(id: string): Submission | null {
    const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getByBatchId(batchId: string): Submission[] {
    const rows = db.prepare('SELECT * FROM submissions WHERE batch_id = ? ORDER BY created_at DESC').all(batchId) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static getByStatus(status: SubmissionStatus): Submission[] {
    const rows = db.prepare('SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC').all(status) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static getAll(limit: number = 100, offset: number = 0): Submission[] {
    const rows = db.prepare('SELECT * FROM submissions ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static update(id: string, updates: Partial<Omit<Submission, 'id' | 'createdAt'>>): Submission | null {
    const fields: string[] = [];
    const values: any[] = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      const dbField = this.toSnakeCase(key);
      if (key === 'attachments') {
        fields.push(`${dbField} = ?`);
        values.push(JSON.stringify(value));
      } else if (key === 'updatedAt' || (typeof value === 'object' && value instanceof Date)) {
        fields.push(`${dbField} = ?`);
        values.push((value as Date).toISOString());
      } else {
        fields.push(`${dbField} = ?`);
        values.push(value);
      }
    });
    
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = db.prepare(`UPDATE submissions SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getById(id);
  }

  static getStats(batchId?: string): { total: number; pending: number; approved: number; rejected: number; attachmentExpired: number } {
    let whereClause = '';
    const params: any[] = [];
    
    if (batchId) {
      whereClause = 'WHERE batch_id = ?';
      params.push(batchId);
    }

    const rows = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM submissions 
      ${whereClause}
      GROUP BY status
    `).all(...params) as any[];

    const stats = { total: 0, pending: 0, approved: 0, rejected: 0, attachmentExpired: 0 };
    
    rows.forEach((row: any) => {
      const count = Number(row.count);
      stats.total += count;
      if (row.status === SubmissionStatus.PENDING) stats.pending = count;
      if (row.status === SubmissionStatus.APPROVED) stats.approved = count;
      if (row.status === SubmissionStatus.REJECTED) stats.rejected = count;
      if (row.status === SubmissionStatus.ATTACHMENT_EXPIRED) stats.attachmentExpired = count;
    });

    return stats;
  }

  static getDistinctBatchIds(): string[] {
    const rows = db.prepare('SELECT DISTINCT batch_id FROM submissions ORDER BY batch_id DESC').all() as any[];
    return rows.map(row => row.batch_id);
  }

  private static toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  private static mapRow(row: any): Submission {
    const attachments: Attachment[] = JSON.parse(row.attachments);
    
    attachments.forEach(att => {
      att.uploadedAt = new Date(att.uploadedAt);
      att.expireAt = new Date(att.expireAt);
      att.isExpired = att.expireAt < new Date();
    });

    return {
      id: row.id,
      batchId: row.batch_id,
      studentId: row.student_id,
      studentName: row.student_name,
      courseCode: row.course_code,
      courseName: row.course_name,
      content: row.content,
      attachments,
      ruleVersionId: row.rule_version_id,
      status: row.status as SubmissionStatus,
      summary: row.summary,
      conclusion: row.conclusion,
      processingTime: row.processing_time ? Number(row.processing_time) : undefined,
      processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
