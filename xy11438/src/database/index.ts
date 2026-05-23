import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  SourceType,
  DirtyType,
  RecordStatus,
  BaseRecord,
  OrderCalendar,
  CleaningMessage,
  MaintenanceNote,
  ApprovalEmail,
  SupplierStatement,
  FactRecord,
  DirtyRecord,
  AuditLog
} from '../types';

const DB_PATH = './data/cleaning-audit.db';

let db: sqlite3.Database | null = null;

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('[DB] Connected to SQLite database');
      createTables()
        .then(() => resolve())
        .catch(reject);
    });
  });
}

function createTables(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS source_records (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        fact_id TEXT,
        raw_data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        dirty_types TEXT DEFAULT '[]',
        processing_notes TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(source_type, source_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS fact_records (
        fact_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        date TEXT NOT NULL,
        order_info TEXT,
        cleaning_info TEXT,
        maintenance_info TEXT,
        approval_info TEXT,
        reconciliation_status TEXT NOT NULL DEFAULT 'pending',
        mismatch_reasons TEXT DEFAULT '[]',
        verified_amount REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(room_id, date)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS dirty_records (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        dirty_type TEXT NOT NULL,
        field_name TEXT,
        original_value TEXT,
        expected_value TEXT,
        description TEXT NOT NULL,
        resolution TEXT,
        resolved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        fact_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operator TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS supplier_statements (
        statement_id TEXT PRIMARY KEY,
        supplier_name TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        items TEXT NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_fact_room_date ON fact_records(room_id, date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_dirty_record ON dirty_records(record_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_fact ON audit_logs(fact_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_source_fact ON source_records(fact_id)`);

      console.log('[DB] All tables created/verified');
      resolve();
    });
  });
}

export function generateFactId(roomId: string, date: string): string {
  return `fact_${roomId}_${date.replace(/-/g, '')}`;
}

export async function upsertSourceRecord(
  sourceType: SourceType,
  sourceId: string,
  rawData: object,
  operator: string = 'system'
): Promise<{ record: BaseRecord; isNew: boolean; factId: string }> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const now = new Date().toISOString();
    const rawDataStr = JSON.stringify(rawData);

    db.get(
      'SELECT * FROM source_records WHERE source_type = ? AND source_id = ?',
      [sourceType, sourceId],
      async (err, existingRow: any) => {
        if (err) {
          reject(err);
          return;
        }

        let factId = '';
        if (sourceType === 'order_calendar') {
          const order = rawData as OrderCalendar;
          factId = generateFactId(order.roomId, order.checkInDate);
        } else if (sourceType === 'cleaning_group') {
          const cleaning = rawData as CleaningMessage;
          factId = generateFactId(cleaning.roomId, cleaning.scheduledDate);
        } else if (sourceType === 'maintenance_note') {
          const maint = rawData as MaintenanceNote;
          const date = maint.reportedAt.split('T')[0];
          factId = generateFactId(maint.roomId, date);
        } else if (sourceType === 'approval_email') {
          const approval = rawData as ApprovalEmail;
          if (approval.relatedRoomId) {
            const date = approval.requestedAt.split('T')[0];
            factId = generateFactId(approval.relatedRoomId, date);
          } else {
            factId = `fact_approval_${approval.emailId}`;
          }
        }

        if (existingRow) {
          const oldValue = existingRow.raw_data;
          db.run(
            `UPDATE source_records 
             SET raw_data = ?, fact_id = ?, updated_at = ?
             WHERE source_type = ? AND source_id = ?`,
            [rawDataStr, factId || existingRow.fact_id, now, sourceType, sourceId],
            async (updateErr) => {
              if (updateErr) {
                reject(updateErr);
                return;
              }

              await insertAuditLog(
                existingRow.fact_id || factId,
                'update_source_record',
                oldValue,
                rawDataStr,
                operator,
                sourceType
              );

              db.get(
                'SELECT * FROM source_records WHERE source_type = ? AND source_id = ?',
                [sourceType, sourceId],
                (getErr, updatedRow: any) => {
                  if (getErr) {
                    reject(getErr);
                    return;
                  }
                  resolve({
                    record: mapRowToBaseRecord(updatedRow),
                    isNew: false,
                    factId: updatedRow.fact_id
                  });
                }
              );
            }
          );
        } else {
          const id = uuidv4();
          db.run(
            `INSERT INTO source_records 
             (id, source_type, source_id, fact_id, raw_data, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, sourceType, sourceId, factId, rawDataStr, 'pending', now, now],
            async (insertErr) => {
              if (insertErr) {
                reject(insertErr);
                return;
              }

              await insertAuditLog(
                factId,
                'create_source_record',
                undefined,
                rawDataStr,
                operator,
                sourceType
              );

              db.get(
                'SELECT * FROM source_records WHERE id = ?',
                [id],
                (getErr, newRow: any) => {
                  if (getErr) {
                    reject(getErr);
                    return;
                  }
                  resolve({
                    record: mapRowToBaseRecord(newRow),
                    isNew: true,
                    factId
                  });
                }
              );
            }
          );
        }
      }
    );
  });
}

function mapRowToBaseRecord(row: any): BaseRecord {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    factId: row.fact_id,
    rawData: row.raw_data,
    status: row.status as RecordStatus,
    dirtyTypes: JSON.parse(row.dirty_types || '[]'),
    processingNotes: row.processing_notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function upsertFactRecord(
  factId: string,
  roomId: string,
  date: string,
  updates: Partial<{
    orderInfo: OrderCalendar;
    cleaningInfo: CleaningMessage;
    maintenanceInfo: MaintenanceNote[];
    approvalInfo: ApprovalEmail[];
    reconciliationStatus: 'matched' | 'mismatch' | 'pending';
    mismatchReasons: string[];
    verifiedAmount: number;
  }>,
  operator: string = 'system'
): Promise<FactRecord> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const now = new Date().toISOString();

    db.get('SELECT * FROM fact_records WHERE fact_id = ?', [factId], async (err, existingRow: any) => {
      if (err) {
        reject(err);
        return;
      }

      if (existingRow) {
        const current: FactRecord = mapRowToFactRecord(existingRow);
        const merged: FactRecord = {
          ...current,
          orderInfo: updates.orderInfo ?? current.orderInfo,
          cleaningInfo: updates.cleaningInfo ?? current.cleaningInfo,
          maintenanceInfo: updates.maintenanceInfo ?? current.maintenanceInfo,
          approvalInfo: updates.approvalInfo ?? current.approvalInfo,
          reconciliationStatus: updates.reconciliationStatus ?? current.reconciliationStatus,
          mismatchReasons: updates.mismatchReasons ?? current.mismatchReasons,
          verifiedAmount: updates.verifiedAmount ?? current.verifiedAmount,
          updatedAt: now
        };

        db.run(
          `UPDATE fact_records SET 
           order_info = ?, cleaning_info = ?, maintenance_info = ?, 
           approval_info = ?, reconciliation_status = ?, mismatch_reasons = ?, 
           verified_amount = ?, updated_at = ?
           WHERE fact_id = ?`,
          [
            JSON.stringify(merged.orderInfo || null),
            JSON.stringify(merged.cleaningInfo || null),
            JSON.stringify(merged.maintenanceInfo || null),
            JSON.stringify(merged.approvalInfo || null),
            merged.reconciliationStatus,
            JSON.stringify(merged.mismatchReasons || []),
            merged.verifiedAmount,
            now,
            factId
          ],
          async (updateErr) => {
            if (updateErr) {
              reject(updateErr);
              return;
            }

            await insertAuditLog(
              factId,
              'update_fact_record',
              JSON.stringify(current),
              JSON.stringify(merged),
              operator,
              'fact_merge'
            );

            resolve(merged);
          }
        );
      } else {
        const newRecord: FactRecord = {
          factId,
          roomId,
          date,
          orderInfo: updates.orderInfo,
          cleaningInfo: updates.cleaningInfo,
          maintenanceInfo: updates.maintenanceInfo,
          approvalInfo: updates.approvalInfo,
          reconciliationStatus: updates.reconciliationStatus || 'pending',
          mismatchReasons: updates.mismatchReasons || [],
          verifiedAmount: updates.verifiedAmount,
          createdAt: now,
          updatedAt: now
        };

        db.run(
          `INSERT INTO fact_records 
           (fact_id, room_id, date, order_info, cleaning_info, maintenance_info, 
            approval_info, reconciliation_status, mismatch_reasons, verified_amount, 
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            factId,
            roomId,
            date,
            JSON.stringify(newRecord.orderInfo || null),
            JSON.stringify(newRecord.cleaningInfo || null),
            JSON.stringify(newRecord.maintenanceInfo || null),
            JSON.stringify(newRecord.approvalInfo || null),
            newRecord.reconciliationStatus,
            JSON.stringify(newRecord.mismatchReasons || []),
            newRecord.verifiedAmount,
            now,
            now
          ],
          async (insertErr) => {
            if (insertErr) {
              reject(insertErr);
              return;
            }

            await insertAuditLog(
              factId,
              'create_fact_record',
              undefined,
              JSON.stringify(newRecord),
              operator,
              'fact_merge'
            );

            resolve(newRecord);
          }
        );
      }
    });
  });
}

function mapRowToFactRecord(row: any): FactRecord {
  return {
    factId: row.fact_id,
    roomId: row.room_id,
    date: row.date,
    orderInfo: row.order_info ? JSON.parse(row.order_info) : undefined,
    cleaningInfo: row.cleaning_info ? JSON.parse(row.cleaning_info) : undefined,
    maintenanceInfo: row.maintenance_info ? JSON.parse(row.maintenance_info) : undefined,
    approvalInfo: row.approval_info ? JSON.parse(row.approval_info) : undefined,
    reconciliationStatus: row.reconciliation_status,
    mismatchReasons: JSON.parse(row.mismatch_reasons || '[]'),
    verifiedAmount: row.verified_amount,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function insertDirtyRecord(
  recordId: string,
  sourceType: SourceType,
  dirtyType: DirtyType,
  description: string,
  fieldName?: string,
  originalValue?: string,
  expectedValue?: string
): Promise<DirtyRecord> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO dirty_records 
       (id, record_id, source_type, dirty_type, field_name, original_value, 
        expected_value, description, resolved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, recordId, sourceType, dirtyType, fieldName, originalValue, expectedValue, description, now],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          id,
          recordId,
          sourceType,
          dirtyType,
          fieldName,
          originalValue,
          expectedValue,
          description,
          resolved: false,
          createdAt: now
        });
      }
    );
  });
}

export async function resolveDirtyRecord(
  dirtyId: string,
  resolution: string,
  operator: string = 'system'
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const now = new Date().toISOString();

    db.run(
      `UPDATE dirty_records SET resolved = 1, resolution = ?, resolved_at = ? WHERE id = ?`,
      [resolution, now, dirtyId],
      async (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.get('SELECT * FROM dirty_records WHERE id = ?', [dirtyId], (getErr, row: any) => {
          if (getErr) {
            reject(getErr);
            return;
          }
          resolve();
        });
      }
    );
  });
}

export async function insertAuditLog(
  factId: string,
  action: string,
  oldValue: string | undefined,
  newValue: string | undefined,
  operator: string,
  source: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO audit_logs 
       (id, fact_id, action, old_value, new_value, operator, timestamp, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, factId, action, oldValue, newValue, operator, now, source],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

export async function getFactRecord(factId: string): Promise<FactRecord | null> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    db.get('SELECT * FROM fact_records WHERE fact_id = ?', [factId], (err, row: any) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row ? mapRowToFactRecord(row) : null);
    });
  });
}

export async function getFactRecordsByDateRange(
  startDate: string,
  endDate: string
): Promise<FactRecord[]> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    db.all(
      'SELECT * FROM fact_records WHERE date >= ? AND date <= ? ORDER BY date, room_id',
      [startDate, endDate],
      (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows.map(mapRowToFactRecord));
      }
    );
  });
}

export async function getDirtyRecords(resolved?: boolean): Promise<DirtyRecord[]> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    let query = 'SELECT * FROM dirty_records';
    const params: any[] = [];

    if (resolved !== undefined) {
      query += ' WHERE resolved = ?';
      params.push(resolved ? 1 : 0);
    }

    db.all(query, params, (err, rows: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows.map(mapRowToDirtyRecord));
    });
  });
}

function mapRowToDirtyRecord(row: any): DirtyRecord {
  return {
    id: row.id,
    recordId: row.record_id,
    sourceType: row.source_type,
    dirtyType: row.dirty_type,
    fieldName: row.field_name,
    originalValue: row.original_value,
    expectedValue: row.expected_value,
    description: row.description,
    resolution: row.resolution,
    resolved: row.resolved === 1,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at
  };
}

export async function getAuditLogs(factId: string): Promise<AuditLog[]> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    db.all(
      'SELECT * FROM audit_logs WHERE fact_id = ? ORDER BY timestamp DESC',
      [factId],
      (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows.map(mapRowToAuditLog));
      }
    );
  });
}

function mapRowToAuditLog(row: any): AuditLog {
  return {
    id: row.id,
    factId: row.fact_id,
    action: row.action,
    oldValue: row.old_value,
    newValue: row.new_value,
    operator: row.operator,
    timestamp: row.timestamp,
    source: row.source
  };
}

export async function upsertSupplierStatement(statement: SupplierStatement): Promise<SupplierStatement> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const now = new Date().toISOString();
    const itemsStr = JSON.stringify(statement.items);

    db.get(
      'SELECT * FROM supplier_statements WHERE statement_id = ?',
      [statement.statementId],
      (err, existingRow: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (existingRow) {
          db.run(
            `UPDATE supplier_statements SET 
             supplier_name = ?, period_start = ?, period_end = ?, 
             items = ?, total_amount = ?, status = ?, updated_at = ?
             WHERE statement_id = ?`,
            [
              statement.supplierName,
              statement.periodStart,
              statement.periodEnd,
              itemsStr,
              statement.totalAmount,
              statement.status,
              now,
              statement.statementId
            ],
            (updateErr) => {
              if (updateErr) {
                reject(updateErr);
                return;
              }
              resolve(statement);
            }
          );
        } else {
          db.run(
            `INSERT INTO supplier_statements 
             (statement_id, supplier_name, period_start, period_end, items, total_amount, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              statement.statementId,
              statement.supplierName,
              statement.periodStart,
              statement.periodEnd,
              itemsStr,
              statement.totalAmount,
              statement.status,
              now,
              now
            ],
            (insertErr) => {
              if (insertErr) {
                reject(insertErr);
                return;
              }
              resolve(statement);
            }
          );
        }
      }
    );
  });
}

export async function getSupplierStatements(): Promise<SupplierStatement[]> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    db.all('SELECT * FROM supplier_statements ORDER BY period_start DESC', (err, rows: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows.map(mapRowToSupplierStatement));
    });
  });
}

function mapRowToSupplierStatement(row: any): SupplierStatement {
  return {
    statementId: row.statement_id,
    supplierName: row.supplier_name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    items: JSON.parse(row.items),
    totalAmount: row.total_amount,
    status: row.status
  };
}

export async function updateSourceRecordStatus(
  sourceType: SourceType,
  sourceId: string,
  status: RecordStatus,
  dirtyTypes: DirtyType[] = [],
  processingNotes: string = ''
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const now = new Date().toISOString();

    db.run(
      `UPDATE source_records 
       SET status = ?, dirty_types = ?, processing_notes = ?, updated_at = ?
       WHERE source_type = ? AND source_id = ?`,
      [status, JSON.stringify(dirtyTypes), processingNotes, now, sourceType, sourceId],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

export function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('[DB] Database connection closed');
      resolve();
    });
  });
}
