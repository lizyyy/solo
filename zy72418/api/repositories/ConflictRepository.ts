import type { Database } from "better-sqlite3";
import type { ConflictRecord, ConflictResolution } from "@shared/types";

const rowToConflict = (row: any): ConflictRecord => ({
  id: row.id,
  recordId: row.record_id,
  fieldName: row.field_name,
  audioRemarkValue: row.audio_remark_value,
  authorizationValue: row.authorization_value,
  audioRemarkSource: row.audio_remark_source,
  authorizationSource: row.authorization_source,
  resolution: row.resolution as ConflictResolution,
  resolvedBy: row.resolved_by,
  resolvedAt: row.resolved_at,
  resolutionReason: row.resolution_reason,
  createdAt: row.created_at,
});

export class ConflictRepository {
  constructor(private db: Database) {}

  findAll(includeResolved = false): ConflictRecord[] {
    let sql = "SELECT * FROM conflict_records";
    if (!includeResolved) {
      sql += " WHERE resolution IS NULL";
    }
    sql += " ORDER BY created_at DESC";
    const rows = this.db.prepare(sql).all();
    return rows.map(rowToConflict);
  }

  findById(id: string): ConflictRecord | null {
    const row = this.db.prepare("SELECT * FROM conflict_records WHERE id = ?").get(id);
    return row ? rowToConflict(row) : null;
  }

  findByRecordId(recordId: string): ConflictRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM conflict_records WHERE record_id = ? ORDER BY created_at DESC")
      .all(recordId);
    return rows.map(rowToConflict);
  }

  create(
    conflict: Omit<
      ConflictRecord,
      "resolution" | "resolvedBy" | "resolvedAt" | "resolutionReason" | "createdAt"
    >
  ): ConflictRecord {
    this.db
      .prepare(
        `INSERT INTO conflict_records (
          id, record_id, field_name, audio_remark_value, authorization_value,
          audio_remark_source, authorization_source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        conflict.id,
        conflict.recordId,
        conflict.fieldName,
        conflict.audioRemarkValue,
        conflict.authorizationValue,
        conflict.audioRemarkSource,
        conflict.authorizationSource,
        new Date().toISOString()
      );
    return this.findById(conflict.id)!;
  }

  resolve(
    id: string,
    resolution: "confirm" | "reject",
    reason: string,
    operator: string
  ): ConflictRecord | null {
    this.db
      .prepare(
        `UPDATE conflict_records 
         SET resolution = ?, resolution_reason = ?, resolved_by = ?, resolved_at = ? 
         WHERE id = ?`
      )
      .run(resolution, reason, operator, new Date().toISOString(), id);
    return this.findById(id);
  }
}
