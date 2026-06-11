import type { AuditLog, AuditLogQuery } from '../../shared/types.js';
import { db } from '../db/index.js';

export class AuditRepo {
  rowToLog(row: any): AuditLog {
    return row as AuditLog;
  }

  list(query: AuditLogQuery = {}): AuditLog[] {
    let rows = db.all('audit_log') as any[];
    if (query.collisionId) rows = rows.filter((r) => r.collisionId === query.collisionId);
    if (query.operator) rows = rows.filter((r) => r.operator === query.operator);
    if (query.actionType) rows = rows.filter((r) => r.action === query.actionType);
    if (query.from) rows = rows.filter((r) => r.timestamp >= query.from!);
    if (query.to) rows = rows.filter((r) => r.timestamp <= query.to!);
    return rows
      .map((r) => this.rowToLog(r))
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
      .slice(0, 500);
  }

  insert(l: AuditLog): void {
    db.insert('audit_log', structuredClone(l));
  }
}
