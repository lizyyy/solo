import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import type { ModificationLog, EntityType } from '../../shared/types.js';

export class ModificationService {
  static getModifications(entityType?: EntityType, entityId?: string): ModificationLog[] {
    let sql = `
      SELECT id, entityType, entityId, field, oldValue, newValue, reason, modifiedBy, createdAt
      FROM modification_logs
    `;
    const params: string[] = [];
    const where: string[] = [];

    if (entityType) {
      where.push('entityType = ?');
      params.push(entityType);
    }
    if (entityId) {
      where.push('entityId = ?');
      params.push(entityId);
    }

    if (where.length > 0) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    sql += ' ORDER BY createdAt DESC';

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      id: string;
      entityType: string;
      entityId: string;
      field: string;
      oldValue: string;
      newValue: string;
      reason: string;
      modifiedBy: string;
      createdAt: string;
    }>;

    return rows.map(row => ({
      ...row,
      entityType: row.entityType as EntityType
    }));
  }

  static logModification(
    entityType: EntityType,
    entityId: string,
    field: string,
    oldValue: string,
    newValue: string,
    reason: string,
    modifiedBy: string
  ): ModificationLog {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO modification_logs (id, entityType, entityId, field, oldValue, newValue, reason, modifiedBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, entityType, entityId, field, oldValue, newValue, reason, modifiedBy, now);

    return {
      id,
      entityType,
      entityId,
      field,
      oldValue,
      newValue,
      reason,
      modifiedBy,
      createdAt: now
    };
  }
}

export default ModificationService;
