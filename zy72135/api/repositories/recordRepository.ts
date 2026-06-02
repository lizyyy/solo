import db from '../db';
import type { TrackCleanupRecord, RecordStatus, RecordSource, FilterState } from '../../shared/types';

function rowToRecord(row: any): TrackCleanupRecord {
  return {
    id: row.id,
    trackName: row.track_name,
    artistName: row.artist_name,
    status: row.status as RecordStatus,
    source: row.source as RecordSource,
    hasAuthorization: row.has_authorization === 1,
    isDuplicate: row.is_duplicate === 1,
    isOldMaster: row.is_old_master === 1,
    isRenamed: row.is_renamed === 1,
    originalTrackName: row.original_track_name || undefined,
    currentNote: row.current_note,
    latestHandler: row.latest_handler,
    latestHandleTime: row.latest_handle_time,
    originalSource: row.original_source,
    originalHandleTime: row.original_handle_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function findAll(filters?: FilterState): TrackCleanupRecord[] {
  let sql = 'SELECT * FROM track_cleanup_records WHERE 1=1';
  const params: any[] = [];

  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.source) {
    sql += ' AND source = ?';
    params.push(filters.source);
  }
  if (filters?.searchKeyword) {
    sql += ' AND (track_name LIKE ? OR artist_name LIKE ? OR current_note LIKE ?)';
    const keyword = `%${filters.searchKeyword}%`;
    params.push(keyword, keyword, keyword);
  }
  if (filters?.dateFrom) {
    sql += ' AND latest_handle_time >= ?';
    params.push(filters.dateFrom);
  }
  if (filters?.dateTo) {
    sql += ' AND latest_handle_time <= ?';
    params.push(filters.dateTo);
  }

  sql += ' ORDER BY latest_handle_time DESC';

  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(rowToRecord);
}

export function findById(id: string): TrackCleanupRecord | undefined {
  const row = db.prepare('SELECT * FROM track_cleanup_records WHERE id = ?').get(id) as any;
  return row ? rowToRecord(row) : undefined;
}

export function update(id: string, updates: Partial<TrackCleanupRecord>): TrackCleanupRecord | undefined {
  const setClauses: string[] = [];
  const params: any[] = [];

  const fieldMap: Record<string, string> = {
    trackName: 'track_name',
    artistName: 'artist_name',
    status: 'status',
    source: 'source',
    hasAuthorization: 'has_authorization',
    isDuplicate: 'is_duplicate',
    isOldMaster: 'is_old_master',
    isRenamed: 'is_renamed',
    originalTrackName: 'original_track_name',
    currentNote: 'current_note',
    latestHandler: 'latest_handler',
    latestHandleTime: 'latest_handle_time',
  };

  Object.entries(updates).forEach(([key, value]) => {
    const dbField = fieldMap[key];
    if (dbField) {
      setClauses.push(`${dbField} = ?`);
      if (typeof value === 'boolean') {
        params.push(value ? 1 : 0);
      } else {
        params.push(value);
      }
    }
  });

  if (setClauses.length === 0) {
    return findById(id);
  }

  setClauses.push('updated_at = ?');
  params.push(new Date().toISOString());

  const sql = `UPDATE track_cleanup_records SET ${setClauses.join(', ')} WHERE id = ?`;
  params.push(id);

  db.prepare(sql).run(...params);
  return findById(id);
}
