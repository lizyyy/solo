import type { Database } from "better-sqlite3";
import type { ImportBatch } from "@shared/types";

const rowToBatch = (row: any): ImportBatch => ({
  id: row.id,
  fileName: row.file_name,
  totalCount: row.total_count,
  newCount: row.new_count,
  duplicateCurrentCount: row.duplicate_current_count,
  duplicateHistoryCount: row.duplicate_history_count,
  importedBy: row.imported_by,
  createdAt: row.created_at,
});

export class ImportBatchRepository {
  constructor(private db: Database) {}

  findAll(): ImportBatch[] {
    const rows = this.db
      .prepare("SELECT * FROM import_batches ORDER BY created_at DESC")
      .all();
    return rows.map(rowToBatch);
  }

  findById(id: string): ImportBatch | null {
    const row = this.db.prepare("SELECT * FROM import_batches WHERE id = ?").get(id);
    return row ? rowToBatch(row) : null;
  }

  create(data: Omit<ImportBatch, "createdAt">): ImportBatch {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO import_batches (
          id, file_name, total_count, new_count, duplicate_current_count,
          duplicate_history_count, imported_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.id,
        data.fileName,
        data.totalCount,
        data.newCount,
        data.duplicateCurrentCount,
        data.duplicateHistoryCount,
        data.importedBy,
        now
      );
    return this.findById(data.id)!;
  }
}
