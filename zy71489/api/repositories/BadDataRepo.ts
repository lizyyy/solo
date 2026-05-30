import db from '../db/index.js';
import type { BadDataRecord } from '../../shared/types.js';

interface BadDataRow {
  id: string;
  source_file: string;
  line_number: number;
  raw_content: string;
  error_type: string;
  error_message: string;
  detected_at: string;
  import_session: string;
}

function rowToBadData(row: BadDataRow): BadDataRecord {
  return {
    id: row.id,
    sourceFile: row.source_file,
    lineNumber: row.line_number,
    rawContent: row.raw_content,
    errorType: row.error_type as 'missing_field' | 'invalid_format' | 'invalid_duration' | 'duplicate' | 'unknown_track',
    errorMessage: row.error_message,
    detectedAt: row.detected_at,
    importSession: row.import_session,
  };
}

export class BadDataRepo {
  private db: typeof db;

  constructor() {
    this.db = db;
  }

  create(record: Omit<BadDataRecord, 'detectedAt'>): BadDataRecord {
    const stmt = this.db.prepare(`
      INSERT INTO bad_data (id, source_file, line_number, raw_content, error_type, error_message, import_session)
      VALUES (@id, @sourceFile, @lineNumber, @rawContent, @errorType, @errorMessage, @importSession)
    `);

    stmt.run({
      id: record.id,
      sourceFile: record.sourceFile,
      lineNumber: record.lineNumber,
      rawContent: record.rawContent,
      errorType: record.errorType,
      errorMessage: record.errorMessage,
      importSession: record.importSession,
    });

    return this.findById(record.id)!;
  }

  createBatch(records: Omit<BadDataRecord, 'detectedAt'>[]): BadDataRecord[] {
    const stmt = this.db.prepare(`
      INSERT INTO bad_data (id, source_file, line_number, raw_content, error_type, error_message, import_session)
      VALUES (@id, @sourceFile, @lineNumber, @rawContent, @errorType, @errorMessage, @importSession)
    `);

    const insertMany = this.db.transaction((recs: Omit<BadDataRecord, 'detectedAt'>[]) => {
      for (const record of recs) {
        stmt.run({
          id: record.id,
          sourceFile: record.sourceFile,
          lineNumber: record.lineNumber,
          rawContent: record.rawContent,
          errorType: record.errorType,
          errorMessage: record.errorMessage,
          importSession: record.importSession,
        });
      }
    });

    insertMany(records);
    return records.map(r => this.findById(r.id)!);
  }

  findById(id: string): BadDataRecord | null {
    const stmt = this.db.prepare('SELECT * FROM bad_data WHERE id = ?');
    const row = stmt.get(id) as BadDataRow | undefined;
    return row ? rowToBadData(row) : null;
  }

  findAll(): BadDataRecord[] {
    const stmt = this.db.prepare('SELECT * FROM bad_data ORDER BY detected_at DESC');
    const rows = stmt.all() as BadDataRow[];
    return rows.map(rowToBadData);
  }

  findByImportSession(importSession: string): BadDataRecord[] {
    const stmt = this.db.prepare('SELECT * FROM bad_data WHERE import_session = ? ORDER BY line_number ASC');
    const rows = stmt.all(importSession) as BadDataRow[];
    return rows.map(rowToBadData);
  }

  findByErrorType(errorType: 'missing_field' | 'invalid_format' | 'invalid_duration' | 'duplicate' | 'unknown_track'): BadDataRecord[] {
    const stmt = this.db.prepare('SELECT * FROM bad_data WHERE error_type = ? ORDER BY detected_at DESC');
    const rows = stmt.all(errorType) as BadDataRow[];
    return rows.map(rowToBadData);
  }

  findBySourceFile(sourceFile: string): BadDataRecord[] {
    const stmt = this.db.prepare('SELECT * FROM bad_data WHERE source_file = ? ORDER BY line_number ASC');
    const rows = stmt.all(sourceFile) as BadDataRow[];
    return rows.map(rowToBadData);
  }

  findRecent(limit: number = 100): BadDataRecord[] {
    const stmt = this.db.prepare('SELECT * FROM bad_data ORDER BY detected_at DESC LIMIT ?');
    const rows = stmt.all(limit) as BadDataRow[];
    return rows.map(rowToBadData);
  }

  update(id: string, updates: Partial<Omit<BadDataRecord, 'id' | 'detectedAt' | 'importSession'>>): BadDataRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: Record<string, unknown> = { id };

    if (updates.sourceFile !== undefined) {
      fields.push('source_file = @sourceFile');
      values.sourceFile = updates.sourceFile;
    }
    if (updates.lineNumber !== undefined) {
      fields.push('line_number = @lineNumber');
      values.lineNumber = updates.lineNumber;
    }
    if (updates.rawContent !== undefined) {
      fields.push('raw_content = @rawContent');
      values.rawContent = updates.rawContent;
    }
    if (updates.errorType !== undefined) {
      fields.push('error_type = @errorType');
      values.errorType = updates.errorType;
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = @errorMessage');
      values.errorMessage = updates.errorMessage;
    }

    if (fields.length === 0) return existing;

    const stmt = this.db.prepare(`
      UPDATE bad_data
      SET ${fields.join(', ')}
      WHERE id = @id
    `);

    stmt.run(values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM bad_data WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  deleteByImportSession(importSession: string): number {
    const stmt = this.db.prepare('DELETE FROM bad_data WHERE import_session = ?');
    const result = stmt.run(importSession);
    return result.changes;
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM bad_data');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  countByImportSession(importSession: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM bad_data WHERE import_session = ?');
    const row = stmt.get(importSession) as { count: number };
    return row.count;
  }

  countByErrorType(errorType: 'missing_field' | 'invalid_format' | 'invalid_duration' | 'duplicate' | 'unknown_track'): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM bad_data WHERE error_type = ?');
    const row = stmt.get(errorType) as { count: number };
    return row.count;
  }
}

export default BadDataRepo;
