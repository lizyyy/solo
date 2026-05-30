import db from '../db/index.js';
import type { AuditLog } from '../../shared/types.js';

interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_change: string | null;
  after_change: string | null;
  operator: string;
  timestamp: string;
  ip: string | null;
}

function rowToAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    action: row.action as 'create' | 'update' | 'delete' | 'import' | 'decision' | 'export',
    entityType: row.entity_type as 'track' | 'vote' | 'copyright' | 'decision',
    entityId: row.entity_id ?? undefined,
    beforeChange: row.before_change ? JSON.parse(row.before_change) : undefined,
    afterChange: row.after_change ? JSON.parse(row.after_change) : undefined,
    operator: row.operator,
    timestamp: row.timestamp,
    ip: row.ip ?? undefined,
  };
}

export class AuditRepo {
  private db: typeof db;

  constructor() {
    this.db = db;
  }

  create(log: Omit<AuditLog, 'timestamp'>): AuditLog {
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (id, action, entity_type, entity_id, before_change, after_change, operator, ip)
      VALUES (@id, @action, @entityType, @entityId, @beforeChange, @afterChange, @operator, @ip)
    `);

    stmt.run({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ?? null,
      beforeChange: log.beforeChange !== undefined ? JSON.stringify(log.beforeChange) : null,
      afterChange: log.afterChange !== undefined ? JSON.stringify(log.afterChange) : null,
      operator: log.operator,
      ip: log.ip ?? null,
    });

    return this.findById(log.id)!;
  }

  findById(id: string): AuditLog | null {
    const stmt = this.db.prepare('SELECT * FROM audit_logs WHERE id = ?');
    const row = stmt.get(id) as AuditLogRow | undefined;
    return row ? rowToAuditLog(row) : null;
  }

  findAll(): AuditLog[] {
    const stmt = this.db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC');
    const rows = stmt.all() as AuditLogRow[];
    return rows.map(rowToAuditLog);
  }

  findByEntityType(entityType: 'track' | 'vote' | 'copyright' | 'decision'): AuditLog[] {
    const stmt = this.db.prepare('SELECT * FROM audit_logs WHERE entity_type = ? ORDER BY timestamp DESC');
    const rows = stmt.all(entityType) as AuditLogRow[];
    return rows.map(rowToAuditLog);
  }

  findByAction(action: 'create' | 'update' | 'delete' | 'import' | 'decision' | 'export'): AuditLog[] {
    const stmt = this.db.prepare('SELECT * FROM audit_logs WHERE action = ? ORDER BY timestamp DESC');
    const rows = stmt.all(action) as AuditLogRow[];
    return rows.map(rowToAuditLog);
  }

  findByEntityId(entityId: string): AuditLog[] {
    const stmt = this.db.prepare('SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY timestamp DESC');
    const rows = stmt.all(entityId) as AuditLogRow[];
    return rows.map(rowToAuditLog);
  }

  findByOperator(operator: string): AuditLog[] {
    const stmt = this.db.prepare('SELECT * FROM audit_logs WHERE operator = ? ORDER BY timestamp DESC');
    const rows = stmt.all(operator) as AuditLogRow[];
    return rows.map(rowToAuditLog);
  }

  findRecent(limit: number = 100): AuditLog[] {
    const stmt = this.db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(limit) as AuditLogRow[];
    return rows.map(rowToAuditLog);
  }

  findByTimeRange(startTime: string, endTime: string): AuditLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC
    `);
    const rows = stmt.all(startTime, endTime) as AuditLogRow[];
    return rows.map(rowToAuditLog);
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  countByAction(action: 'create' | 'update' | 'delete' | 'import' | 'decision' | 'export'): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs WHERE action = ?');
    const row = stmt.get(action) as { count: number };
    return row.count;
  }
}

export default AuditRepo;
