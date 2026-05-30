import { getDb } from '../db/connection';
import type { Setlist, CreateSetlistRequest, UpdateSetlistRequest, Song } from '../../shared/types';

const rowToSetlist = (row: Record<string, unknown>, songs: Song[] = []): Setlist => {
  const songList = songs || [];
  const totalDuration = songList.reduce((sum, s) => sum + s.duration, 0);
  
  return {
    id: row.id as string,
    tourName: row.tour_name as string,
    venue: row.venue as string,
    date: row.date as string,
    maxDuration: row.max_duration as number,
    status: row.status as Setlist['status'],
    currentVersion: row.current_version as number,
    createdAt: row.created_at as string,
    lastValidated: row.last_validated as string | undefined,
    totalDuration,
    songCount: songList.length,
    version: row.current_version as number,
    lastUpdated: (row.last_updated as string) || (row.created_at as string),
    lastCheckResult: row.last_check_result_json
      ? JSON.parse(row.last_check_result_json as string)
      : undefined,
    songs: songList,
  };
};

export const SetlistRepository = {
  findAll: (): Setlist[] => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM setlists ORDER BY date DESC').all() as Record<string, unknown>[];
    return rows.map(row => rowToSetlist(row, []));
  },

  findById: (id: string): Setlist | null => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM setlists WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToSetlist(row, []) : null;
  },

  findByIdWithSongs: (id: string): Setlist | null => {
    const db = getDb();
    const setlistRow = db.prepare('SELECT * FROM setlists WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!setlistRow) return null;

    const songRows = db.prepare(`
      SELECT * FROM songs 
      WHERE setlist_id = ? 
      ORDER BY song_order ASC
    `).all(id) as Record<string, unknown>[];

    const songs = songRows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      setlistId: row.setlist_id as string,
      name: row.name as string,
      originalKey: row.original_key as Song['originalKey'],
      currentKey: row.current_key as Song['currentKey'],
      duration: row.duration as number,
      order: row.song_order as number,
      vocalRange: row.vocal_range_min && row.vocal_range_max
        ? { min: row.vocal_range_min as string, max: row.vocal_range_max as string }
        : undefined,
      vocalNotes: row.vocal_notes as string | undefined,
      instrumentTunings: {
        guitar: row.guitar_tuning as string | undefined,
        bass: row.bass_tuning as string | undefined,
        keys: row.keys_tuning as string | undefined,
      },
      version: row.version as number,
      lastUpdated: row.last_updated as string,
      updatedBy: row.updated_by as string,
      updateReason: row.update_reason as string | undefined,
    }));

    return rowToSetlist(setlistRow, songs);
  },

  create: (id: string, data: CreateSetlistRequest): Setlist => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO setlists (id, tour_name, venue, date, max_duration, status, current_version, created_at, last_updated)
      VALUES (?, ?, ?, ?, ?, 'draft', 1, ?, ?)
    `).run(id, data.tourName, data.venue, data.date, data.maxDuration, now, now);

    return SetlistRepository.findById(id)!;
  },

  update: (id: string, data: UpdateSetlistRequest): Setlist | null => {
    const db = getDb();
    const existing = SetlistRepository.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.tourName !== undefined) {
      fields.push('tour_name = ?');
      values.push(data.tourName);
    }
    if (data.venue !== undefined) {
      fields.push('venue = ?');
      values.push(data.venue);
    }
    if (data.date !== undefined) {
      fields.push('date = ?');
      values.push(data.date);
    }
    if (data.maxDuration !== undefined) {
      fields.push('max_duration = ?');
      values.push(data.maxDuration);
    }
    if (fields.length > 0) {
      fields.push('current_version = current_version + 1');
      fields.push('last_updated = ?');
      fields.push('status = ?');
      values.push(new Date().toISOString());
      values.push('draft');
      values.push(id);
      db.prepare(`UPDATE setlists SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    return SetlistRepository.findById(id);
  },

  updateStatus: (id: string, status: Setlist['status'], checkResult?: { passed: number; errors: number; warnings: number }): Setlist | null => {
    const db = getDb();
    const now = new Date().toISOString();
    if (checkResult) {
      db.prepare(`
        UPDATE setlists 
        SET status = ?, last_validated = ?, last_updated = ?, last_check_result_json = ?
        WHERE id = ?
      `).run(status, now, now, JSON.stringify(checkResult), id);
    } else {
      db.prepare(`
        UPDATE setlists 
        SET status = ?, last_validated = ?, last_updated = ?
        WHERE id = ?
      `).run(status, now, now, id);
    }
    return SetlistRepository.findById(id);
  },

  delete: (id: string): boolean => {
    const db = getDb();
    const result = db.prepare('DELETE FROM setlists WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

export default SetlistRepository;
