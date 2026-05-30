import { getDb } from '../db/connection';
import type { SongVersion, SetlistVersion } from '../../shared/types';

const rowToSongVersion = (row: Record<string, unknown>): SongVersion => ({
  id: row.id as number,
  songId: row.song_id as string,
  version: row.version as number,
  fieldName: row.field_name as string,
  oldValue: row.old_value as string | undefined,
  newValue: row.new_value as string,
  updatedAt: row.updated_at as string,
  updatedBy: row.updated_by as string,
  reason: row.reason as string | undefined,
});

const rowToSetlistVersion = (row: Record<string, unknown>): SetlistVersion => ({
  id: row.id as number,
  setlistId: row.setlist_id as string,
  version: row.version as number,
  snapshot: row.snapshot as string,
  createdAt: row.created_at as string,
  createdBy: row.created_by as string,
  description: row.description as string | undefined,
});

export const VersionHistoryRepository = {
  addSongVersion: (
    songId: string,
    version: number,
    fieldName: string,
    oldValue: string | undefined,
    newValue: string,
    updatedBy: string,
    reason?: string
  ): number => {
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO song_versions (song_id, version, field_name, old_value, new_value, updated_at, updated_by, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(songId, version, fieldName, oldValue || null, newValue, now, updatedBy, reason || null);
    return Number(result.lastInsertRowid);
  },

  getSongVersions: (songId: string): SongVersion[] => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM song_versions 
      WHERE song_id = ? 
      ORDER BY version DESC, id DESC
    `).all(songId) as Record<string, unknown>[];
    return rows.map(rowToSongVersion);
  },

  getSongFieldVersions: (songId: string, fieldName: string): SongVersion[] => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM song_versions 
      WHERE song_id = ? AND field_name = ?
      ORDER BY version DESC, id DESC
    `).all(songId, fieldName) as Record<string, unknown>[];
    return rows.map(rowToSongVersion);
  },

  getSetlistSongVersions: (setlistId: string): SongVersion[] => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT sv.* FROM song_versions sv
      INNER JOIN songs s ON sv.song_id = s.id
      WHERE s.setlist_id = ?
      ORDER BY sv.updated_at DESC
    `).all(setlistId) as Record<string, unknown>[];
    return rows.map(rowToSongVersion);
  },

  addSetlistVersion: (
    setlistId: string,
    version: number,
    snapshot: string,
    createdBy: string,
    description?: string
  ): number => {
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO setlist_versions (setlist_id, version, snapshot, created_at, created_by, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(setlistId, version, snapshot, now, createdBy, description || null);
    return Number(result.lastInsertRowid);
  },

  getSetlistVersions: (setlistId: string): SetlistVersion[] => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM setlist_versions 
      WHERE setlist_id = ? 
      ORDER BY version DESC, id DESC
    `).all(setlistId) as Record<string, unknown>[];
    return rows.map(rowToSetlistVersion);
  },
};

export default VersionHistoryRepository;
