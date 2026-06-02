import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import type { OriginalSnapshot, ImportSource } from '../../shared/types.js';

export class SnapshotRepository {
  create(data: {
    batchId: string;
    originalLineNo: number;
    rawContent: string;
    importSource: ImportSource;
    fileHash?: string;
  }): OriginalSnapshot {
    const now = new Date().toISOString();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO original_snapshots (
        id, batch_id, original_line_no, raw_content,
        imported_at, import_source, file_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.batchId, data.originalLineNo, data.rawContent,
      now, data.importSource, data.fileHash || null
    );
    return this.findById(id)!;
  }

  findById(id: string): OriginalSnapshot | null {
    const row = db.prepare('SELECT * FROM original_snapshots WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBatchId(batchId: string): OriginalSnapshot[] {
    const rows = db.prepare(`
      SELECT * FROM original_snapshots 
      WHERE batch_id = ? ORDER BY original_line_no ASC
    `).all(batchId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByFileHash(fileHash: string): OriginalSnapshot | null {
    const row = db.prepare('SELECT * FROM original_snapshots WHERE file_hash = ? LIMIT 1').get(fileHash) as any;
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: any): OriginalSnapshot {
    return {
      id: row.id,
      batchId: row.batch_id,
      originalLineNo: row.original_line_no,
      rawContent: row.raw_content,
      importedAt: row.imported_at,
      importSource: row.import_source as ImportSource,
      fileHash: row.file_hash
    };
  }
}

export default new SnapshotRepository();
