process.removeAllListeners('warning');

import { db, rowToTrack, type TrackRow } from '../db.js';
import type { Track, TrackStatus, LitterIssueType } from '../../shared/types.js';

function generateId(): string {
  return 'track-' + Math.random().toString(36).slice(2, 10);
}

export interface ListTracksOptions {
  search?: string;
  status?: TrackStatus;
  sortBy?: 'createdAt' | 'updatedAt' | 'petName';
}

export const TrackRepo = {
  list(options: ListTracksOptions = {}): Track[] {
    const { search, status, sortBy = 'createdAt' } = options;
    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push('(petName LIKE ? OR aliases LIKE ?)');
      params.push(searchTerm, searchTerm);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const orderColumn = sortBy === 'petName' ? 'petName' : sortBy === 'updatedAt' ? 'updatedAt' : 'createdAt';
    const orderDir = sortBy === 'petName' ? 'ASC' : 'DESC';

    const rows = db
      .prepare(`SELECT * FROM tracks ${whereClause} ORDER BY ${orderColumn} ${orderDir}`)
      .all(...params) as TrackRow[];

    return rows.map((row) => rowToTrack(row));
  },

  getById(id: string): Track | null {
    const row = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as TrackRow | undefined;
    if (!row) return null;
    return rowToTrack(row);
  },

  create(data: {
    petName: string;
    aliases: string[];
    issueType: LitterIssueType;
    initialVisitDate: string;
    status: TrackStatus;
    abnormalReason?: string;
    currentNote: string;
    lastOperator: string;
  }): Track {
    const id = generateId();
    const now = new Date().toISOString();
    const revisionCount = 0;
    const aliasWarning = 0;

    db.prepare(`
      INSERT INTO tracks (id, petName, aliases, issueType, initialVisitDate, status, abnormalReason, currentNote, revisionCount, aliasWarning, createdAt, updatedAt, lastOperator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.petName,
      JSON.stringify(data.aliases),
      data.issueType,
      data.initialVisitDate,
      data.status,
      data.abnormalReason ?? null,
      data.currentNote,
      revisionCount,
      aliasWarning,
      now,
      now,
      data.lastOperator,
    );

    return TrackRepo.getById(id)!;
  },

  update(id: string, data: Partial<{
    petName: string;
    aliases: string[];
    issueType: LitterIssueType;
    initialVisitDate: string;
    status: TrackStatus;
    abnormalReason: string | null;
    currentNote: string;
    revisionCount: number;
    aliasWarning: boolean;
    lastOperator: string;
  }>): Track | null {
    const existing = TrackRepo.getById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: any[] = [];

    if (data.petName !== undefined) { fields.push('petName = ?'); params.push(data.petName); }
    if (data.aliases !== undefined) { fields.push('aliases = ?'); params.push(JSON.stringify(data.aliases)); }
    if (data.issueType !== undefined) { fields.push('issueType = ?'); params.push(data.issueType); }
    if (data.initialVisitDate !== undefined) { fields.push('initialVisitDate = ?'); params.push(data.initialVisitDate); }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (data.abnormalReason !== undefined) { fields.push('abnormalReason = ?'); params.push(data.abnormalReason); }
    if (data.currentNote !== undefined) { fields.push('currentNote = ?'); params.push(data.currentNote); }
    if (data.revisionCount !== undefined) { fields.push('revisionCount = ?'); params.push(data.revisionCount); }
    if (data.aliasWarning !== undefined) { fields.push('aliasWarning = ?'); params.push(data.aliasWarning ? 1 : 0); }
    if (data.lastOperator !== undefined) { fields.push('lastOperator = ?'); params.push(data.lastOperator); }

    fields.push('updatedAt = ?');
    params.push(new Date().toISOString());
    params.push(id);

    db.prepare(`UPDATE tracks SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return TrackRepo.getById(id);
  },

  checkAliasConflicts(
    petName: string,
    aliases: string[],
    trackIdToSkip?: string,
  ): string | null {
    const allNames = [petName, ...aliases].map((n) => n.trim().toLowerCase()).filter(Boolean);
    if (allNames.length === 0) return null;

    const allTracks = TrackRepo.list();
    const conflicts: string[] = [];

    for (const track of allTracks) {
      if (trackIdToSkip && track.id === trackIdToSkip) continue;
      const trackNames = [track.petName, ...track.aliases].map((n) => n.trim().toLowerCase());

      for (const name of allNames) {
        if (trackNames.includes(name)) {
          conflicts.push(`宠物名/别名"${name}"与${track.id}(${track.petName})冲突`);
        }
      }
    }

    return conflicts.length > 0 ? conflicts.join('；') : null;
  },
};
