import { getDb } from '../db/connection';
import type { Song, CreateSongRequest, UpdateSongRequest } from '../../shared/types';

const rowToSong = (row: Record<string, unknown>): Song => ({
  id: row.id as string,
  setlistId: row.setlist_id as string,
  name: row.name as string,
  originalKey: row.original_key as Song['originalKey'],
  currentKey: row.current_key as Song['currentKey'],
  duration: row.duration as number,
  order: row.song_order as number,
  vocalRange: row.vocal_range_min && row.vocal_range_max
    ? { min: row.vocal_range_min as Song['originalKey'], max: row.vocal_range_max as Song['originalKey'] }
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
});

export const SongRepository = {
  findBySetlistId: (setlistId: string): Song[] => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM songs 
      WHERE setlist_id = ? 
      ORDER BY song_order ASC
    `).all(setlistId) as Record<string, unknown>[];
    return rows.map(rowToSong);
  },

  findById: (id: string): Song | null => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToSong(row) : null;
  },

  create: (id: string, setlistId: string, data: CreateSongRequest): Song => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO songs (
        id, setlist_id, name, original_key, current_key, duration, song_order,
        vocal_range_min, vocal_range_max, vocal_notes, guitar_tuning, bass_tuning, keys_tuning,
        version, last_updated, updated_by, update_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      id, setlistId, data.name, data.originalKey, data.currentKey, data.duration, data.order,
      data.vocalRange?.min || null, data.vocalRange?.max || null, data.vocalNotes || null,
      data.instrumentTunings?.guitar || null, data.instrumentTunings?.bass || null,
      data.instrumentTunings?.keys || null, now, data.updatedBy, data.updateReason || null
    );
    return SongRepository.findById(id)!;
  },

  update: (id: string, data: UpdateSongRequest): Song | null => {
    const db = getDb();
    const existing = SongRepository.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const newVersion = existing.version + 1;

    const fields: string[] = ['version = ?', 'last_updated = ?', 'updated_by = ?'];
    const values: unknown[] = [newVersion, now, data.updatedBy];

    if (data.updateReason !== undefined) {
      fields.push('update_reason = ?');
      values.push(data.updateReason);
    }
    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.originalKey !== undefined) {
      fields.push('original_key = ?');
      values.push(data.originalKey);
    }
    if (data.currentKey !== undefined) {
      fields.push('current_key = ?');
      values.push(data.currentKey);
    }
    if (data.duration !== undefined) {
      fields.push('duration = ?');
      values.push(data.duration);
    }
    if (data.order !== undefined) {
      fields.push('song_order = ?');
      values.push(data.order);
    }
    if (data.vocalRange !== undefined) {
      fields.push('vocal_range_min = ?', 'vocal_range_max = ?');
      values.push(data.vocalRange.min, data.vocalRange.max);
    }
    if (data.vocalNotes !== undefined) {
      fields.push('vocal_notes = ?');
      values.push(data.vocalNotes);
    }
    if (data.instrumentTunings !== undefined) {
      if (data.instrumentTunings.guitar !== undefined) {
        fields.push('guitar_tuning = ?');
        values.push(data.instrumentTunings.guitar);
      }
      if (data.instrumentTunings.bass !== undefined) {
        fields.push('bass_tuning = ?');
        values.push(data.instrumentTunings.bass);
      }
      if (data.instrumentTunings.keys !== undefined) {
        fields.push('keys_tuning = ?');
        values.push(data.instrumentTunings.keys);
      }
    }

    values.push(id);
    db.prepare(`UPDATE songs SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return SongRepository.findById(id);
  },

  delete: (id: string): boolean => {
    const db = getDb();
    const result = db.prepare('DELETE FROM songs WHERE id = ?').run(id);
    return result.changes > 0;
  },

  getMaxOrder: (setlistId: string): number => {
    const db = getDb();
    const result = db.prepare(`
      SELECT MAX(song_order) as max_order FROM songs WHERE setlist_id = ?
    `).get(setlistId) as { max_order: number | null };
    return result.max_order || 0;
  },
};

export default SongRepository;
