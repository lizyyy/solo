import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import type { ImportBatch } from '../../shared/types';

export class ImportRepository {
  create(
    fileHash: string,
    contentFingerprint: string,
    fileName: string,
    totalRows: number,
    operator: string,
    isForceReimport: boolean = false
  ): ImportBatch {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO import_batch (id, file_hash, content_fingerprint, file_name, total_rows, operator, is_force_reimport)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, fileHash, contentFingerprint, fileName, totalRows, operator, isForceReimport ? 1 : 0);
    return this.findById(id) as ImportBatch;
  }

  findById(id: string): ImportBatch | null {
    const stmt = db.prepare('SELECT * FROM import_batch WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapToModel(row) : null;
  }

  findByHash(fileHash: string, contentFingerprint: string): ImportBatch | null {
    const stmt = db.prepare(`
      SELECT * FROM import_batch 
      WHERE file_hash = ? OR content_fingerprint = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(fileHash, contentFingerprint) as any;
    return row ? this.mapToModel(row) : null;
  }

  findAll(): ImportBatch[] {
    const stmt = db.prepare('SELECT * FROM import_batch ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapToModel(row));
  }

  private mapToModel(row: any): ImportBatch {
    return {
      id: row.id,
      fileHash: row.file_hash,
      contentFingerprint: row.content_fingerprint,
      fileName: row.file_name,
      totalRows: row.total_rows,
      operator: row.operator,
      createdAt: row.created_at,
      isForceReimport: row.is_force_reimport === 1,
    };
  }
}

export const importRepository = new ImportRepository();
