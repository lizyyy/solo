import { db } from '../data/database';
import { v4 as uuidv4 } from 'uuid';
import type { BikeRecord, SourceInfo, ConflictInfo } from '../../shared/types';

export interface BikeRecordRow {
  id: string;
  stationName: string;
  exitNo: string;
  lat: number;
  lng: number;
  timeSlot: string;
  bikeCount: number;
  capacity: number;
  reason: string;
  status: string;
  notes: string | null;
  mergedFrom: string | null;
  reviewTime: string | null;
  createTime: string;
  updateTime: string;
  isOldCaliber: number;
}

export interface SourceRow {
  id: string;
  recordId: string;
  type: string;
  name: string;
  date: string;
  rawContent: string;
  importTime: string;
}

export interface ConflictRow {
  id: string;
  recordId: string;
  type: string;
  humanMessage: string;
  relatedRecordIds: string;
  details: string | null;
}

function mapRowToRecord(row: BikeRecordRow, sources: SourceInfo[], conflicts: ConflictInfo[]): BikeRecord {
  return {
    id: row.id,
    stationName: row.stationName,
    exitNo: row.exitNo,
    lat: row.lat,
    lng: row.lng,
    timeSlot: row.timeSlot,
    bikeCount: row.bikeCount,
    capacity: row.capacity,
    reason: row.reason,
    status: row.status as BikeRecord['status'],
    notes: row.notes || '',
    sources,
    conflicts,
    mergedFrom: row.mergedFrom ? JSON.parse(row.mergedFrom) : [],
    reviewTime: row.reviewTime || undefined,
    createTime: row.createTime,
    updateTime: row.updateTime,
    isOldCaliber: row.isOldCaliber === 1,
  };
}

function mapSourceRow(row: SourceRow): SourceInfo {
  return {
    id: row.id,
    type: row.type as SourceInfo['type'],
    name: row.name,
    date: row.date,
    rawContent: row.rawContent,
    importTime: row.importTime,
  };
}

function mapConflictRow(row: ConflictRow): ConflictInfo {
  return {
    type: row.type as ConflictInfo['type'],
    humanMessage: row.humanMessage,
    relatedRecordIds: JSON.parse(row.relatedRecordIds),
    details: row.details ? JSON.parse(row.details) : undefined,
  };
}

export class RecordRepository {
  findAll(): BikeRecord[] {
    const rows = db.prepare('SELECT * FROM bike_records ORDER BY createTime DESC').all() as BikeRecordRow[];
    return rows.map(row => this.hydrateRecord(row));
  }

  findById(id: string): BikeRecord | null {
    const row = db.prepare('SELECT * FROM bike_records WHERE id = ?').get(id) as BikeRecordRow | undefined;
    if (!row) return null;
    return this.hydrateRecord(row);
  }

  findByStationAndExit(stationName: string, exitNo: string): BikeRecord[] {
    const rows = db.prepare(
      'SELECT * FROM bike_records WHERE stationName = ? AND exitNo = ? ORDER BY createTime DESC'
    ).all(stationName, exitNo) as BikeRecordRow[];
    return rows.map(row => this.hydrateRecord(row));
  }

  private hydrateRecord(row: BikeRecordRow): BikeRecord {
    const sourceRows = db.prepare(
      'SELECT * FROM sources WHERE recordId = ? ORDER BY importTime DESC'
    ).all(row.id) as SourceRow[];
    const conflictRows = db.prepare(
      'SELECT * FROM conflicts WHERE recordId = ?'
    ).all(row.id) as ConflictRow[];

    return mapRowToRecord(
      row,
      sourceRows.map(mapSourceRow),
      conflictRows.map(mapConflictRow)
    );
  }

  create(record: Omit<BikeRecord, 'id' | 'createTime' | 'updateTime'>): BikeRecord {
    const now = new Date().toISOString();
    const id = uuidv4();

    const insertRecord = db.prepare(`
      INSERT INTO bike_records (
        id, stationName, exitNo, lat, lng, timeSlot, bikeCount, capacity, reason,
        status, notes, mergedFrom, reviewTime, createTime, updateTime, isOldCaliber
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertRecord.run(
      id,
      record.stationName,
      record.exitNo,
      record.lat,
      record.lng,
      record.timeSlot,
      record.bikeCount,
      record.capacity,
      record.reason,
      record.status,
      record.notes || null,
      record.mergedFrom.length > 0 ? JSON.stringify(record.mergedFrom) : null,
      record.reviewTime || null,
      now,
      now,
      record.isOldCaliber ? 1 : 0
    );

    const insertSource = db.prepare(`
      INSERT INTO sources (id, recordId, type, name, date, rawContent, importTime)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const source of record.sources) {
      const sourceId = uuidv4();
      insertSource.run(sourceId, id, source.type, source.name, source.date, source.rawContent, source.importTime);
    }

    const insertConflict = db.prepare(`
      INSERT INTO conflicts (id, recordId, type, humanMessage, relatedRecordIds, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const conflict of record.conflicts) {
      const conflictId = uuidv4();
      insertConflict.run(
        conflictId,
        id,
        conflict.type,
        conflict.humanMessage,
        JSON.stringify(conflict.relatedRecordIds),
        conflict.details ? JSON.stringify(conflict.details) : null
      );
    }

    return this.findById(id)!;
  }

  update(id: string, updates: Partial<BikeRecord>): BikeRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes || null);
    }
    if (updates.reason !== undefined) {
      fields.push('reason = ?');
      values.push(updates.reason);
    }
    if (updates.stationName !== undefined) {
      fields.push('stationName = ?');
      values.push(updates.stationName);
    }
    if (updates.exitNo !== undefined) {
      fields.push('exitNo = ?');
      values.push(updates.exitNo);
    }
    if (updates.lat !== undefined) {
      fields.push('lat = ?');
      values.push(updates.lat);
    }
    if (updates.lng !== undefined) {
      fields.push('lng = ?');
      values.push(updates.lng);
    }
    if (updates.reviewTime !== undefined) {
      fields.push('reviewTime = ?');
      values.push(updates.reviewTime || null);
    }

    fields.push('updateTime = ?');
    values.push(now);
    values.push(id);

    if (fields.length > 1) {
      const sql = `UPDATE bike_records SET ${fields.join(', ')} WHERE id = ?`;
      db.prepare(sql).run(...values);
    }

    if (updates.conflicts !== undefined) {
      db.prepare('DELETE FROM conflicts WHERE recordId = ?').run(id);
      const insertConflict = db.prepare(`
        INSERT INTO conflicts (id, recordId, type, humanMessage, relatedRecordIds, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const conflict of updates.conflicts) {
        const conflictId = uuidv4();
        insertConflict.run(
          conflictId,
          id,
          conflict.type,
          conflict.humanMessage,
          JSON.stringify(conflict.relatedRecordIds),
          conflict.details ? JSON.stringify(conflict.details) : null
        );
      }
    }

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM bike_records WHERE id = ?').run(id);
    return result.changes > 0;
  }

  deleteMany(ids: string[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(', ');
    const result = db.prepare(`DELETE FROM bike_records WHERE id IN (${placeholders})`).run(...ids);
    return result.changes;
  }

  count(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM bike_records').get() as { count: number };
    return row.count;
  }

  clearAll(): void {
    db.prepare('DELETE FROM conflicts').run();
    db.prepare('DELETE FROM sources').run();
    db.prepare('DELETE FROM bike_records').run();
  }
}

export const recordRepository = new RecordRepository();
