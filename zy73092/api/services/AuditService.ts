import { getDb, rowToAuditLog } from '../db/database.js';
import type { AuditLog, OperationType, OpinionSource } from '../../shared/types.js';

export interface WriteLogParams {
  materialId: number | null;
  materialCode: string;
  operation: OperationType;
  operator: string;
  operatorRole: 'ENGINEER' | 'PM';
  changeDetail: Record<string, unknown>;
  sourceTag?: OpinionSource | null;
}

export class AuditService {
  static getAuditLogs(filters?: {
    materialId?: number;
    operation?: OperationType;
    sourceTag?: OpinionSource;
    operatorRole?: 'ENGINEER' | 'PM';
  }): AuditLog[] {
    const d = getDb();
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    if (filters?.materialId != null) {
      clauses.push('material_id = @materialId');
      params.materialId = filters.materialId;
    }
    if (filters?.operation) {
      clauses.push('operation = @operation');
      params.operation = filters.operation;
    }
    if (filters?.sourceTag) {
      clauses.push('source_tag = @sourceTag');
      params.sourceTag = filters.sourceTag;
    }
    if (filters?.operatorRole) {
      clauses.push('operator_role = @operatorRole');
      params.operatorRole = filters.operatorRole;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = d.prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC, id DESC`).all(params) as any[];
    return rows.map(rowToAuditLog);
  }

  static writeLog(p: WriteLogParams): number {
    const d = getDb();
    const info = d.prepare(`
      INSERT INTO audit_logs (material_id, material_code, operation, operator, operator_role, change_detail, source_tag)
      VALUES (@material_id, @material_code, @operation, @operator, @operator_role, @change_detail, @source_tag)
    `).run({
      material_id: p.materialId,
      material_code: p.materialCode,
      operation: p.operation,
      operator: p.operator,
      operator_role: p.operatorRole,
      change_detail: JSON.stringify(p.changeDetail),
      source_tag: p.sourceTag ?? null,
    });
    return Number(info.lastInsertRowid);
  }
}
