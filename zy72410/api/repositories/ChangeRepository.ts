import type { Database } from 'better-sqlite3';
import type { RehearsalChange, HistoryRecord } from '../../shared/types.js';
import { generateId } from '../db/init.js';

export class ChangeRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  create(data: Omit<RehearsalChange, 'id' | 'created_at'>): RehearsalChange {
    const id = generateId();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO rehearsal_change (
        id, material_id, track_id, field_name, old_value, new_value,
        operator, change_reason, affected_items, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.material_id,
      data.track_id || null,
      data.field_name,
      data.old_value,
      data.new_value,
      data.operator,
      data.change_reason,
      JSON.stringify(data.affected_items),
      now
    );
    return this.findById(id)!;
  }

  findById(id: string): RehearsalChange | null {
    const stmt = this.db.prepare('SELECT * FROM rehearsal_change WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapChange(row) : null;
  }

  findByMaterialId(material_id: string): RehearsalChange[] {
    const stmt = this.db.prepare(`
      SELECT * FROM rehearsal_change
      WHERE material_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(material_id) as any[];
    return rows.map(row => this.mapChange(row));
  }

  findAll(): RehearsalChange[] {
    const stmt = this.db.prepare(`
      SELECT * FROM rehearsal_change ORDER BY created_at DESC LIMIT 100
    `);
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapChange(row));
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM rehearsal_change');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  createHistoryRecord(data: Omit<HistoryRecord, 'id' | 'created_at'>): HistoryRecord {
    const id = generateId();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO history_record (
        id, material_id, track_id, field_name, old_value, new_value,
        operator, change_reason, record_snapshot, change_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.material_id,
      data.track_id || null,
      data.field_name || '',
      data.old_value || '',
      data.new_value || '',
      data.operator || '',
      data.change_reason || '',
      JSON.stringify(data.record_snapshot),
      data.change_id,
      now
    );
    return this.findHistoryById(id)!;
  }

  findHistoryByMaterialId(material_id: string): HistoryRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM history_record
      WHERE material_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(material_id) as any[];
    return rows.map(row => this.mapHistory(row));
  }

  getLatestVersion(material_id: string, track_id?: string): number {
    let sql = 'SELECT COUNT(*) as count FROM history_record WHERE material_id = ?';
    const params: string[] = [material_id];
    if (track_id) {
      sql += ' AND track_id = ?';
      params.push(track_id);
    }
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params) as { count: number };
    return row.count || 0;
  }

  findHistoryById(id: string): HistoryRecord | null {
    const stmt = this.db.prepare('SELECT * FROM history_record WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapHistory(row) : null;
  }

  private mapChange(row: any): RehearsalChange {
    return {
      id: row.id,
      material_id: row.material_id,
      track_id: row.track_id || '',
      field_name: row.field_name,
      old_value: row.old_value,
      new_value: row.new_value,
      operator: row.operator,
      change_reason: row.change_reason,
      affected_items: JSON.parse(row.affected_items || '[]'),
      created_at: row.created_at
    };
  }

  private mapHistory(row: any): HistoryRecord {
    return {
      id: row.id,
      material_id: row.material_id,
      track_id: row.track_id || '',
      field_name: row.field_name || '',
      old_value: row.old_value || '',
      new_value: row.new_value || '',
      operator: row.operator || '',
      change_reason: row.change_reason || '',
      record_snapshot: JSON.parse(row.record_snapshot),
      change_id: row.change_id,
      created_at: row.created_at
    };
  }
}
