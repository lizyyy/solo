process.removeAllListeners('warning');

import { db, rowToMaterial, type MaterialRow } from '../db.js';
import type { Material, MaterialType } from '../../shared/types.js';

function generateId(): string {
  return 'mat-' + Math.random().toString(36).slice(2, 10);
}

export const MaterialRepo = {
  listByTrackId(trackId: string): Material[] {
    const rows = db
      .prepare('SELECT * FROM materials WHERE trackId = ? ORDER BY uploadedAt ASC, version ASC')
      .all(trackId) as MaterialRow[];
    return rows.map(rowToMaterial);
  },

  getById(id: string): Material | null {
    const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(id) as MaterialRow | undefined;
    if (!row) return null;
    return rowToMaterial(row);
  },

  create(data: {
    trackId: string;
    type: MaterialType;
    fileName: string;
    filePath: string;
    fileSize: number;
    uploadedBy: string;
    version?: number;
    replacedMaterialId?: string;
    summary: string;
    hasConsistencyChange?: boolean;
    consistencyChangeNote?: string;
  }): Material {
    const id = generateId();
    const now = new Date().toISOString();
    const version = data.version ?? 1;
    const hasConsistencyChange = data.hasConsistencyChange ?? false;

    db.prepare(`
      INSERT INTO materials (id, trackId, type, fileName, filePath, fileSize, uploadedBy, uploadedAt, version, replacedMaterialId, summary, hasConsistencyChange, consistencyChangeNote)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.trackId,
      data.type,
      data.fileName,
      data.filePath,
      data.fileSize,
      data.uploadedBy,
      now,
      version,
      data.replacedMaterialId ?? null,
      data.summary,
      hasConsistencyChange ? 1 : 0,
      data.consistencyChangeNote ?? null,
    );

    return MaterialRepo.getById(id)!;
  },

  bulkCreate(materials: Array<{
    trackId: string;
    type: MaterialType;
    fileName: string;
    filePath: string;
    fileSize: number;
    uploadedBy: string;
    version?: number;
    replacedMaterialId?: string;
    summary: string;
    hasConsistencyChange?: boolean;
    consistencyChangeNote?: string;
  }>): Material[] {
    return materials.map((m) => MaterialRepo.create(m));
  },

  markReplaced(id: string, replacedMaterialId: string): Material | null {
    db.prepare('UPDATE materials SET replacedMaterialId = ? WHERE id = ?').run(replacedMaterialId, id);
    return MaterialRepo.getById(id);
  },

  deleteByTrackId(trackId: string): void {
    db.prepare('DELETE FROM materials WHERE trackId = ?').run(trackId);
  },
};
