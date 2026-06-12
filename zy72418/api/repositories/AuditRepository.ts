import type { Database } from "better-sqlite3";
import type { AuditLog, OperatorRole } from "@shared/types";

const rowToAudit = (row: any): AuditLog => ({
  id: row.id,
  recordId: row.record_id,
  operator: row.operator,
  operatorRole: row.operator_role as OperatorRole,
  action: row.action,
  fieldName: row.field_name,
  oldValue: row.old_value,
  newValue: row.new_value,
  reason: row.reason,
  affectedResultIds: JSON.parse(row.affected_result_ids || "[]"),
  createdAt: row.created_at,
});

export class AuditRepository {
  constructor(private db: Database) {}

  findAll(recordId?: string): AuditLog[] {
    let sql = "SELECT * FROM audit_logs";
    const params: any[] = [];
    if (recordId) {
      sql += " WHERE record_id = ?";
      params.push(recordId);
    }
    sql += " ORDER BY created_at DESC";
    const rows = this.db.prepare(sql).all(...params);
    return rows.map(rowToAudit);
  }

  create(
    log: Omit<AuditLog, "id" | "createdAt">
  ): AuditLog {
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db
      .prepare(
        `INSERT INTO audit_logs (
          id, record_id, operator, operator_role, action, field_name,
          old_value, new_value, reason, affected_result_ids, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        log.recordId,
        log.operator,
        log.operatorRole,
        log.action,
        log.fieldName ?? null,
        log.oldValue ?? null,
        log.newValue ?? null,
        log.reason,
        JSON.stringify(log.affectedResultIds || []),
        new Date().toISOString()
      );
    const row = this.db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(id);
    return rowToAudit(row);
  }
}
