process.removeAllListeners('warning');

import { db, rowToRevision, type RevisionRow } from '../db.js';
import type { Revision, TrackStatus } from '../../shared/types.js';

function generateId(): string {
  return 'rev-' + Math.random().toString(36).slice(2, 10);
}

export const RevisionRepo = {
  listByTrackId(trackId: string): Revision[] {
    const rows = db
      .prepare('SELECT * FROM revisions WHERE trackId = ? ORDER BY version ASC')
      .all(trackId) as RevisionRow[];
    return rows.map(rowToRevision);
  },

  getById(id: string): Revision | null {
    const row = db.prepare('SELECT * FROM revisions WHERE id = ?').get(id) as RevisionRow | undefined;
    if (!row) return null;
    return rowToRevision(row);
  },

  create(data: {
    trackId: string;
    version: number;
    oldStatus: TrackStatus | null;
    newStatus: TrackStatus;
    reviseReason: string;
    noteSnapshot: string;
    operator: string;
    newMaterialIds: string[];
  }): Revision {
    const id = generateId();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO revisions (id, trackId, version, oldStatus, newStatus, reviseReason, noteSnapshot, operator, createdAt, newMaterialIds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.trackId,
      data.version,
      data.oldStatus,
      data.newStatus,
      data.reviseReason,
      data.noteSnapshot,
      data.operator,
      now,
      JSON.stringify(data.newMaterialIds),
    );

    return RevisionRepo.getById(id)!;
  },
};
