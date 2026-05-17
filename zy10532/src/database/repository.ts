import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  Tenant,
  TrialFeature,
  RecycleRecord,
  RecycleException,
  RecycleStatus,
  RecycleAction,
  QueryRecycleRequest
} from '../types';

export class RecycleRepository {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  createTenant(tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO tenants (id, tenant_id, tenant_name, customer_name, sales_person, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, tenant.tenantId, tenant.tenantName, tenant.customerName, tenant.salesPerson, now, now, (err) => {
        if (err) reject(err);
        else resolve({ ...tenant, id, createdAt: now, updatedAt: now });
      });
      stmt.finalize();
    });
  }

  createTrialFeature(feature: Omit<TrialFeature, 'id' | 'createdAt' | 'updatedAt'>): Promise<TrialFeature> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO trial_features (id, tenant_id, feature_code, feature_name, trial_start_date, trial_end_date, original_end_date, granted_by, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, feature.tenantId, feature.featureCode, feature.featureName, feature.trialStartDate, feature.trialEndDate, feature.originalEndDate, feature.grantedBy, feature.isActive ? 1 : 0, now, now, (err) => {
        if (err) reject(err);
        else resolve({ ...feature, id, createdAt: now, updatedAt: now });
      });
      stmt.finalize();
    });
  }

  createRecycleRecord(record: Omit<RecycleRecord, 'id' | 'createdAt' | 'updatedAt' | 'reminderCount' | 'salesConfirmStatus'>): Promise<RecycleRecord> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO recycle_records (
          id, tenant_id, feature_id, trial_end_date, status, sales_confirm_status,
          recycle_action, raw_input, processing_evidence, created_by, created_at, updated_at, reminder_count
        )
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, 0)
      `);
      stmt.run(id, record.tenantId, record.featureId, record.trialEndDate, record.status, record.recycleAction, record.rawInput || null, record.processingEvidence || null, record.createdBy, now, now, (err) => {
        if (err) reject(err);
        else resolve({ ...record, id, salesConfirmStatus: 'pending', reminderCount: 0, createdAt: now, updatedAt: now });
      });
      stmt.finalize();
    });
  }

  getRecycleRecordById(id: string): Promise<RecycleRecord | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM recycle_records WHERE id = ?`, [id], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRecycleRecord(row));
      });
    });
  }

  getRecycleRecords(query: QueryRecycleRequest): Promise<{ records: RecycleRecord[]; total: number }> {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM recycle_records WHERE 1=1`;
      let countSql = `SELECT COUNT(*) as total FROM recycle_records WHERE 1=1`;
      const params: any[] = [];

      if (query.tenantId) {
        sql += ` AND tenant_id = ?`;
        countSql += ` AND tenant_id = ?`;
        params.push(query.tenantId);
      }
      if (query.status) {
        sql += ` AND status = ?`;
        countSql += ` AND status = ?`;
        params.push(query.status);
      }

      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const offset = (page - 1) * pageSize;
      sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;

      this.db.all(sql, [...params, pageSize, offset], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        this.db.get(countSql, params, (errCount, countRow: any) => {
          if (errCount) reject(errCount);
          else resolve({ records: rows.map(r => this.mapRecycleRecord(r)), total: countRow.total });
        });
      });
    });
  }

  updateRecycleRecordStatus(id: string, status: RecycleStatus, evidence?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      let sql = `UPDATE recycle_records SET status = ?, updated_at = ?`;
      const params: any[] = [status, now];
      
      if (evidence) {
        sql += `, processing_evidence = COALESCE(processing_evidence, '') || ?`;
        params.push(`\n[${now}] Status update: ${status}\n${evidence}`);
      }
      sql += ` WHERE id = ?`;
      params.push(id);

      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  updateSalesConfirm(id: string, confirmedBy: string, note: string, confirmStatus: 'confirmed' | 'denied'): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      this.db.run(`
        UPDATE recycle_records 
        SET sales_confirm_status = ?, sales_confirmed_at = ?, sales_confirmed_by = ?, sales_confirm_note = ?, updated_at = ?, status = ?
        WHERE id = ?
      `, [confirmStatus, now, confirmedBy, note, now, confirmStatus === 'confirmed' ? RecycleStatus.CONFIRMED : RecycleStatus.CANCELLED, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  incrementReminder(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      this.db.run(`
        UPDATE recycle_records 
        SET reminder_count = reminder_count + 1, last_reminder_at = ?, updated_at = ?
        WHERE id = ?
      `, [now, now, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  applyExtension(id: string, days: number, reason: string, extendedBy: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      this.db.run(`
        UPDATE recycle_records 
        SET extension_days = ?, extension_reason = ?, extended_by = ?, extended_at = ?, status = ?, updated_at = ?
        WHERE id = ?
      `, [days, reason, extendedBy, now, RecycleStatus.EXTENDED, now, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  completeRecycle(id: string, recycledBy: string, note: string, summary: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      this.db.run(`
        UPDATE recycle_records 
        SET recycled_at = ?, recycled_by = ?, recycle_note = ?, summary = ?, status = ?, updated_at = ?
        WHERE id = ?
      `, [now, recycledBy, note, summary, RecycleStatus.COMPLETED, now, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  createException(exception: Omit<RecycleException, 'id' | 'occurredAt' | 'resolved'>): Promise<RecycleException> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO recycle_exceptions (id, recycle_record_id, error_type, error_message, raw_input, processing_evidence, occurred_at, resolved)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `);
      stmt.run(id, exception.recycleRecordId, exception.errorType, exception.errorMessage, exception.rawInput, exception.processingEvidence, now, (err) => {
        if (err) reject(err);
        else resolve({ ...exception, id, occurredAt: now, resolved: false });
      });
      stmt.finalize();
    });
  }

  getExceptions(recycleRecordId?: string): Promise<RecycleException[]> {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM recycle_exceptions`;
      const params: any[] = [];
      if (recycleRecordId) {
        sql += ` WHERE recycle_record_id = ?`;
        params.push(recycleRecordId);
      }
      sql += ` ORDER BY occurred_at DESC`;
      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(r => this.mapException(r)));
      });
    });
  }

  resolveException(id: string, resolvedBy: string, note: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      this.db.run(`
        UPDATE recycle_exceptions 
        SET resolved = 1, resolved_at = ?, resolved_by = ?, resolution_note = ?
        WHERE id = ?
      `, [now, resolvedBy, note, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  manualUpdateRecord(id: string, updates: Partial<RecycleRecord>, modifiedBy: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const params: any[] = [];

      if (updates.status) { fields.push('status = ?'); params.push(updates.status); }
      if (updates.salesConfirmStatus) { fields.push('sales_confirm_status = ?'); params.push(updates.salesConfirmStatus); }
      if (updates.recycleAction) { fields.push('recycle_action = ?'); params.push(updates.recycleAction); }
      if (updates.trialEndDate) { fields.push('trial_end_date = ?'); params.push(updates.trialEndDate); }

      fields.push('updated_at = ?');
      params.push(now);

      if (fields.length === 1) {
        resolve();
        return;
      }

      params.push(id);
      this.db.run(`UPDATE recycle_records SET ${fields.join(', ')} WHERE id = ?`, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  getTenantById(tenantId: string): Promise<Tenant | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM tenants WHERE tenant_id = ?`, [tenantId], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapTenant(row));
      });
    });
  }

  getFeatureById(featureId: string): Promise<TrialFeature | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM trial_features WHERE id = ?`, [featureId], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapFeature(row));
      });
    });
  }

  getAllRecycleRecords(): Promise<RecycleRecord[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM recycle_records ORDER BY created_at DESC`, [], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(r => this.mapRecycleRecord(r)));
      });
    });
  }

  private mapTenant(row: any): Tenant {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      customerName: row.customer_name,
      salesPerson: row.sales_person,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapFeature(row: any): TrialFeature {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      featureCode: row.feature_code,
      featureName: row.feature_name,
      trialStartDate: row.trial_start_date,
      trialEndDate: row.trial_end_date,
      originalEndDate: row.original_end_date,
      grantedBy: row.granted_by,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRecycleRecord(row: any): RecycleRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      featureId: row.feature_id,
      trialEndDate: row.trial_end_date,
      status: row.status as RecycleStatus,
      salesConfirmStatus: row.sales_confirm_status as any,
      salesConfirmedAt: row.sales_confirmed_at,
      salesConfirmedBy: row.sales_confirmed_by,
      salesConfirmNote: row.sales_confirm_note,
      reminderCount: row.reminder_count,
      lastReminderAt: row.last_reminder_at,
      recycleAction: row.recycle_action as RecycleAction,
      recycleNote: row.recycle_note,
      recycledAt: row.recycled_at,
      recycledBy: row.recycled_by,
      extensionDays: row.extension_days,
      extensionReason: row.extension_reason,
      extendedBy: row.extended_by,
      extendedAt: row.extended_at,
      summary: row.summary,
      rawInput: row.raw_input,
      processingEvidence: row.processing_evidence,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapException(row: any): RecycleException {
    return {
      id: row.id,
      recycleRecordId: row.recycle_record_id,
      errorType: row.error_type,
      errorMessage: row.error_message,
      rawInput: row.raw_input,
      processingEvidence: row.processing_evidence,
      occurredAt: row.occurred_at,
      resolved: row.resolved === 1,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      resolutionNote: row.resolution_note
    };
  }
}
