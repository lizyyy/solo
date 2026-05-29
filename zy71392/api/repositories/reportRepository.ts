import db from '../db/init.js';
import type { Report, ReportItem, ReportStatus, ReviewStatus, ReportItemCategory } from '../types/index.js';

class ReportRepository {
  create(title: string): Report {
    const stmt = db.prepare('INSERT INTO report (title, status) VALUES (?, ?)');
    const result = stmt.run(title, 'draft');
    return this.getById(result.lastInsertRowid as number)!;
  }

  getById(id: number): Report | undefined {
    return db.prepare('SELECT * FROM report WHERE id = ?').get(id) as Report | undefined;
  }

  list(limit = 50): Report[] {
    return db.prepare('SELECT * FROM report ORDER BY created_at DESC LIMIT ?').all(limit) as Report[];
  }

  updateStatus(id: number, status: ReportStatus): void {
    db.prepare('UPDATE report SET status = ? WHERE id = ?').run(status, id);
  }

  delete(id: number): void {
    db.prepare('DELETE FROM report WHERE id = ?').run(id);
  }

  countByStatus(status: ReportStatus): number {
    const result = db.prepare('SELECT COUNT(*) as count FROM report WHERE status = ?').get(status) as { count: number };
    return result.count;
  }

  addItem(item: Omit<ReportItem, 'id'>): ReportItem {
    const stmt = db.prepare(
      'INSERT INTO report_item (report_id, script_id, category, content_json, review_status, review_note) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      item.report_id,
      item.script_id,
      item.category,
      item.content_json,
      item.review_status,
      item.review_note || null
    );
    return db.prepare('SELECT * FROM report_item WHERE id = ?').get(result.lastInsertRowid) as ReportItem;
  }

  getItems(reportId: number, category?: ReportItemCategory): ReportItem[] {
    let sql = 'SELECT * FROM report_item WHERE report_id = ?';
    const params: unknown[] = [reportId];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY id';
    return db.prepare(sql).all(...params) as ReportItem[];
  }

  updateItemReview(id: number, review_status: ReviewStatus, review_note?: string): void {
    db.prepare('UPDATE report_item SET review_status = ?, review_note = COALESCE(?, review_note) WHERE id = ?').run(
      review_status,
      review_note || null,
      id
    );
  }
}

export default new ReportRepository();
