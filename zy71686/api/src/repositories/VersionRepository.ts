import { getDb } from '../db/index.js';
import type { VersionSnapshot, OperationLog } from '../../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class VersionRepository {
  createSnapshot(snapshot: Omit<VersionSnapshot, 'id' | 'createdAt'>): VersionSnapshot {
    const db = getDb();
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO version_snapshot (
        id, name, description, created_at, created_by,
        data_version, calculation_version, data_files, is_active, can_rollback
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      snapshot.name,
      snapshot.description || '',
      createdAt,
      snapshot.createdBy,
      snapshot.dataVersion,
      snapshot.calculationVersion,
      JSON.stringify(snapshot.dataFiles || []),
      snapshot.isActive ? 1 : 0,
      snapshot.canRollback ? 1 : 0
    );
    
    return { ...snapshot, id, createdAt };
  }

  getSnapshot(id: string): VersionSnapshot | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM version_snapshot WHERE id = ?').get(id) as any;
    return row ? this.mapToSnapshot(row) : null;
  }

  getActiveSnapshot(): VersionSnapshot | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM version_snapshot WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get() as any;
    return row ? this.mapToSnapshot(row) : null;
  }

  listSnapshots(limit = 50): VersionSnapshot[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM version_snapshot ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(row => this.mapToSnapshot(row));
  }

  setActiveSnapshot(id: string): boolean {
    const db = getDb();
    const result = db.transaction(() => {
      db.prepare('UPDATE version_snapshot SET is_active = 0 WHERE is_active = 1').run();
      const info = db.prepare('UPDATE version_snapshot SET is_active = 1 WHERE id = ?').run(id);
      return info.changes > 0;
    })();
    return result;
  }

  createOperationLog(log: Omit<OperationLog, 'id' | 'timestamp'>): OperationLog {
    const db = getDb();
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO operation_log (
        id, operation_type, operator, timestamp, description,
        affected_objects, previous_snapshot_id, can_undo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      log.operationType,
      log.operator,
      timestamp,
      log.description,
      JSON.stringify(log.affectedObjects || []),
      log.previousSnapshotId || null,
      log.canUndo ? 1 : 0
    );
    
    return { ...log, id, timestamp };
  }

  listOperationLogs(limit = 100): OperationLog[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM operation_log ORDER BY timestamp DESC LIMIT ?').all(limit) as any[];
    return rows.map(row => this.mapToOperationLog(row));
  }

  getOperationLog(id: string): OperationLog | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM operation_log WHERE id = ?').get(id) as any;
    return row ? this.mapToOperationLog(row) : null;
  }

  undoOperation(logId: string, newSnapshotId: string): boolean {
    const db = getDb();
    const info = db.prepare(`
      UPDATE operation_log SET can_undo = 0 WHERE id = ?
    `).run(logId);
    
    const log = this.getOperationLog(logId);
    if (log && log.previousSnapshotId) {
      this.setActiveSnapshot(log.previousSnapshotId);
    }
    
    return info.changes > 0;
  }

  private mapToSnapshot(row: any): VersionSnapshot {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      createdBy: row.created_by,
      dataVersion: row.data_version,
      calculationVersion: row.calculation_version,
      dataFiles: row.data_files ? JSON.parse(row.data_files) : [],
      isActive: row.is_active === 1,
      canRollback: row.can_rollback === 1
    };
  }

  private mapToOperationLog(row: any): OperationLog {
    return {
      id: row.id,
      operationType: row.operation_type,
      operator: row.operator,
      timestamp: row.timestamp,
      description: row.description,
      affectedObjects: row.affected_objects ? JSON.parse(row.affected_objects) : [],
      previousSnapshotId: row.previous_snapshot_id,
      canUndo: row.can_undo === 1
    };
  }
}

export const versionRepository = new VersionRepository();
