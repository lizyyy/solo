import type { Database } from 'better-sqlite3';
import type { Track } from '../../shared/types.js';
import { generateId } from '../db/init.js';
import { detectReworkReason } from '../utils/detector.js';

export class TrackRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  findByMaterialId(material_id: string): Track[] {
    const stmt = this.db.prepare('SELECT * FROM track WHERE material_id = ? ORDER BY created_at');
    const rows = stmt.all(material_id) as any[];
    return rows.map(row => this.mapTrack(row));
  }

  findById(id: string): Track | null {
    const stmt = this.db.prepare('SELECT * FROM track WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapTrack(row) : null;
  }

  create(data: Omit<Track, 'id' | 'created_at' | 'updated_at'>): Track {
    const id = generateId();
    const now = new Date().toISOString();
    const hasRework = detectReworkReason(data.remarks || '');
    const stmt = this.db.prepare(`
      INSERT INTO track (
        id, material_id, track_name, track_number, track_type, isrc_code, remarks,
        need_recheck, rework_confirmed, rework_confirmed_by, rework_confirmed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.material_id,
      data.track_name,
      data.track_number || 1,
      data.track_type,
      data.isrc_code || '',
      data.remarks,
      hasRework ? 1 : 0,
      0,
      null,
      null,
      now,
      now
    );
    return this.findById(id)!;
  }

  updateRemarks(id: string, remarks: string): Track {
    const hasRework = detectReworkReason(remarks);
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE track
      SET remarks = ?, need_recheck = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(remarks, hasRework ? 1 : 0, now, id);
    return this.findById(id)!;
  }

  markReworkChecked(id: string, checked_by: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE track
      SET rework_confirmed = 1, rework_confirmed_by = ?, rework_confirmed_at = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(checked_by, now, now, id);
  }

  updateVersion(id: string, track_type: string): void {
    const stmt = this.db.prepare(`
      UPDATE track SET track_type = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(track_type, new Date().toISOString(), id);
  }

  findAllWithReworkPending(): Array<Track & { material_name: string }> {
    const stmt = this.db.prepare(`
      SELECT t.*, m.material_name as material_name
      FROM track t
      JOIN material m ON t.material_id = m.id
      WHERE t.need_recheck = 1 AND t.rework_confirmed = 0
      ORDER BY t.updated_at DESC
    `);
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      ...this.mapTrack(row),
      material_name: row.material_name
    }));
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM track');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  countNeedRecheck(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM track WHERE need_recheck = 1 AND rework_confirmed = 0');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  private mapTrack(row: any): Track {
    return {
      id: row.id,
      material_id: row.material_id,
      track_name: row.track_name,
      track_number: row.track_number || 1,
      track_type: row.track_type || '',
      isrc_code: row.isrc_code || '',
      remarks: row.remarks || '',
      need_recheck: row.need_recheck === 1,
      rework_confirmed: row.rework_confirmed === 1,
      rework_confirmed_by: row.rework_confirmed_by || '',
      rework_confirmed_at: row.rework_confirmed_at || '',
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
