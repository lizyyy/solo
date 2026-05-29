import db from '../db/init.js';
import type { Exception, ExceptionStatus } from '../types/index.js';

class ExceptionRepository {
  create(exc: Omit<Exception, 'id' | 'created_at'>): Exception {
    const stmt = db.prepare(
      'INSERT INTO exception (script_id, permission_id, reason, status, expires_at, impact_scope, risk_note) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      exc.script_id,
      exc.permission_id || null,
      exc.reason,
      exc.status,
      exc.expires_at || null,
      exc.impact_scope || null,
      exc.risk_note || null
    );
    return this.getById(result.lastInsertRowid as number)!;
  }

  getById(id: number): Exception | undefined {
    return db.prepare('SELECT * FROM exception WHERE id = ?').get(id) as Exception | undefined;
  }

  list(scriptId?: number, status?: ExceptionStatus): Exception[] {
    let sql = 'SELECT * FROM exception WHERE 1=1';
    const params: unknown[] = [];
    if (scriptId) {
      sql += ' AND script_id = ?';
      params.push(scriptId);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    return db.prepare(sql).all(...params) as Exception[];
  }

  update(id: number, updates: Partial<Exception>): void {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), id];
    db.prepare(`UPDATE exception SET ${fields} WHERE id = ?`).run(...values);
  }

  delete(id: number): void {
    db.prepare('DELETE FROM exception WHERE id = ?').run(id);
  }

  countByStatus(status: ExceptionStatus): number {
    const result = db.prepare('SELECT COUNT(*) as count FROM exception WHERE status = ?').get(status) as { count: number };
    return result.count;
  }

  getLongRunningExceptions(days: number = 30): Exception[] {
    const sql = `
      SELECT * FROM exception 
      WHERE status = 'approved' 
      AND (expires_at IS NULL OR julianday(expires_at) - julianday('now') > ?)
      AND julianday('now') - julianday(created_at) > ?
      ORDER BY created_at DESC
    `;
    return db.prepare(sql).all(days, days) as Exception[];
  }
}

export default new ExceptionRepository();
