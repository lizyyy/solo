import type { Database } from 'better-sqlite3';
import type { TunerMessage, Conflict, ConflictStatus } from '../../shared/types.js';
import { generateId } from '../db/init.js';

export class MessageRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  createMessage(data: Omit<TunerMessage, 'id' | 'created_at'>): TunerMessage {
    const id = generateId();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO tuner_message (id, material_id, content, message_date, recorded_by, has_conflict, conflict_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.material_id, data.content, data.message_date, data.recorded_by, data.has_conflict ? 1 : 0, data.conflict_status || '', now);
    return this.findMessageById(id)!;
  }

  findMessageById(id: string): TunerMessage | null {
    const stmt = this.db.prepare('SELECT * FROM tuner_message WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapMessage(row) : null;
  }

  findMessagesByMaterialId(material_id: string): TunerMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tuner_message
      WHERE material_id = ?
      ORDER BY message_date DESC, created_at DESC
    `);
    const rows = stmt.all(material_id) as any[];
    return rows.map(row => this.mapMessage(row));
  }

  createConflict(data: Omit<Conflict, 'id' | 'resolved_by' | 'resolved_at' | 'created_at'>): Conflict {
    const id = generateId();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO conflict (
        id, material_id, track_id, message_id, field_name, original_value, message_value,
        status, evidence, resolved_by, resolved_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.material_id,
      data.track_id || '',
      data.message_id || '',
      data.field_name,
      data.original_value,
      data.message_value,
      data.status,
      JSON.stringify(data.evidence),
      '',
      '',
      now
    );
    return this.findConflictById(id)!;
  }

  findConflictById(id: string): Conflict | null {
    const stmt = this.db.prepare('SELECT * FROM conflict WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapConflict(row) : null;
  }

  findConflictsByMaterialId(material_id: string, status?: ConflictStatus): Conflict[] {
    let sql = 'SELECT * FROM conflict WHERE material_id = ?';
    const params: string[] = [material_id];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.mapConflict(row));
  }

  findAllConflicts(status?: ConflictStatus): Conflict[] {
    let sql = 'SELECT * FROM conflict';
    const params: string[] = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.mapConflict(row));
  }

  resolveConflict(id: string, status: ConflictStatus, resolved_by: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE conflict
      SET status = ?, resolved_by = ?, resolved_at = ?
      WHERE id = ?
    `);
    stmt.run(status, resolved_by, now, id);
  }

  countPendingConflicts(): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM conflict WHERE status = 'pending'
    `);
    const row = stmt.get() as { count: number };
    return row.count;
  }

  private mapMessage(row: any): TunerMessage {
    return {
      id: row.id,
      material_id: row.material_id,
      content: row.content,
      message_date: row.message_date,
      recorded_by: row.recorded_by,
      has_conflict: row.has_conflict === 1,
      conflict_status: row.conflict_status || '',
      created_at: row.created_at
    };
  }

  private mapConflict(row: any): Conflict {
    return {
      id: row.id,
      material_id: row.material_id,
      track_id: row.track_id || '',
      message_id: row.message_id || '',
      field_name: row.field_name,
      original_value: row.original_value,
      message_value: row.message_value,
      evidence: JSON.parse(row.evidence || '[]'),
      status: row.status as ConflictStatus,
      resolved_by: row.resolved_by || '',
      resolved_at: row.resolved_at || '',
      created_at: row.created_at
    };
  }
}
