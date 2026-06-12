import type { Database } from "better-sqlite3";
import type { AudioRecord, RecordStatus, UpdateRecordRequest } from "@shared/types";

const rowToRecord = (row: any): AudioRecord => ({
  id: row.id,
  audioFileId: row.audio_file_id,
  audioFileName: row.audio_file_name,
  remark: row.remark || "",
  courseName: row.course_name,
  therapistName: row.therapist_name,
  sessionDate: row.session_date,
  duration: row.duration,
  amount: row.amount,
  isTemporarySubstitute: Boolean(row.is_temporary_substitute),
  substituteSource: row.substitute_source,
  authorizationExpiryDate: row.authorization_expiry_date || "",
  status: row.status,
  errorNote: row.error_note || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  importBatchId: row.import_batch_id,
  settlementAmount: row.amount * 0.7,
});

export class RecordRepository {
  constructor(private db: Database) {}

  findAll(status?: RecordStatus): AudioRecord[] {
    let sql = "SELECT * FROM audio_records";
    const params: any[] = [];
    if (status) {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += " ORDER BY session_date DESC, created_at DESC";
    const rows = this.db.prepare(sql).all(...params);
    return rows.map(rowToRecord);
  }

  findById(id: string): AudioRecord | null {
    const row = this.db.prepare("SELECT * FROM audio_records WHERE id = ?").get(id);
    return row ? rowToRecord(row) : null;
  }

  findByAudioFileId(audioFileId: string): AudioRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM audio_records WHERE audio_file_id = ? ORDER BY created_at DESC")
      .all(audioFileId);
    return rows.map(rowToRecord);
  }

  findByBatchId(batchId: string): AudioRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM audio_records WHERE import_batch_id = ? ORDER BY created_at")
      .all(batchId);
    return rows.map(rowToRecord);
  }

  findTemporarySubstitutes(): AudioRecord[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM audio_records WHERE is_temporary_substitute = 1 ORDER BY session_date DESC"
      )
      .all();
    return rows.map(rowToRecord);
  }

  create(record: Omit<AudioRecord, "createdAt" | "updatedAt" | "settlementAmount">): AudioRecord {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO audio_records (
          id, audio_file_id, audio_file_name, remark, course_name, therapist_name,
          session_date, duration, amount, is_temporary_substitute, substitute_source,
          authorization_expiry_date, status, error_note, import_batch_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.audioFileId,
        record.audioFileName,
        record.remark,
        record.courseName,
        record.therapistName,
        record.sessionDate,
        record.duration,
        record.amount,
        record.isTemporarySubstitute ? 1 : 0,
        record.substituteSource,
        record.authorizationExpiryDate,
        record.status,
        record.errorNote || null,
        record.importBatchId,
        now,
        now
      );
    return this.findById(record.id)!;
  }

  update(id: string, updates: Partial<UpdateRecordRequest>): AudioRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: any[] = [];

    const fieldMap: Record<string, string> = {
      remark: "remark",
      courseName: "course_name",
      therapistName: "therapist_name",
      sessionDate: "session_date",
      duration: "duration",
      amount: "amount",
      authorizationExpiryDate: "authorization_expiry_date",
      errorNote: "error_note",
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMap[key];
      if (dbField && value !== undefined) {
        fields.push(`${dbField} = ?`);
        params.push(value);
      }
    }

    fields.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    this.db.prepare(`UPDATE audio_records SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  updateStatus(id: string, status: RecordStatus): AudioRecord | null {
    this.db
      .prepare("UPDATE audio_records SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, new Date().toISOString(), id);
    return this.findById(id);
  }
}
