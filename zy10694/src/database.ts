import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { DeprecationExtension, ExtensionStatus, CreateExtensionRequest } from './types';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = './deprecation-extension.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initTables();
  }

  private initTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS deprecation_extensions (
          id TEXT PRIMARY KEY,
          api_name TEXT NOT NULL,
          api_path TEXT NOT NULL,
          caller TEXT NOT NULL,
          original_deprecation_date TEXT NOT NULL,
          extended_deprecation_date TEXT NOT NULL,
          reason TEXT NOT NULL,
          contact_person TEXT NOT NULL,
          contact_email TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          approved_by TEXT,
          approved_at TEXT,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_message TEXT,
          sync_at TEXT
        )
      `;
      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async createExtension(request: CreateExtensionRequest): Promise<DeprecationExtension> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const extension: DeprecationExtension = {
      id,
      apiName: request.apiName,
      apiPath: request.apiPath,
      caller: request.caller,
      originalDeprecationDate: request.originalDeprecationDate,
      extendedDeprecationDate: request.extendedDeprecationDate,
      reason: request.reason,
      contactPerson: request.contactPerson,
      contactEmail: request.contactEmail,
      status: ExtensionStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending'
    };

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO deprecation_extensions (
          id, api_name, api_path, caller, original_deprecation_date,
          extended_deprecation_date, reason, contact_person, contact_email,
          status, created_at, updated_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      this.db.run(sql, [
        id,
        extension.apiName,
        extension.apiPath,
        extension.caller,
        extension.originalDeprecationDate,
        extension.extendedDeprecationDate,
        extension.reason,
        extension.contactPerson,
        extension.contactEmail,
        extension.status,
        extension.createdAt,
        extension.updatedAt,
        extension.syncStatus
      ], (err) => {
        if (err) reject(err);
        else resolve(extension);
      });
    });
  }

  async getExtensionById(id: string): Promise<DeprecationExtension | null> {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM deprecation_extensions WHERE id = ?';
      this.db.get(sql, [id], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.rowToExtension(row));
      });
    });
  }

  async getExtensions(filters?: {
    status?: ExtensionStatus;
    caller?: string;
    apiPath?: string;
  }): Promise<DeprecationExtension[]> {
    let sql = 'SELECT * FROM deprecation_extensions WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.caller) {
      sql += ' AND caller = ?';
      params.push(filters.caller);
    }
    if (filters?.apiPath) {
      sql += ' AND api_path = ?';
      params.push(filters.apiPath);
    }

    sql += ' ORDER BY created_at DESC';

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.rowToExtension(row)));
      });
    });
  }

  async updateExtensionStatus(
    id: string,
    status: ExtensionStatus,
    approvedBy?: string
  ): Promise<DeprecationExtension | null> {
    const now = new Date().toISOString();
    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const params: any[] = [status, now];

    if (approvedBy) {
      updates.push('approved_by = ?');
      updates.push('approved_at = ?');
      params.push(approvedBy);
      params.push(now);
    }

    const sql = `UPDATE deprecation_extensions SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, async (err) => {
        if (err) reject(err);
        else {
          const updated = await this.getExtensionById(id);
          resolve(updated);
        }
      });
    });
  }

  async updateSyncStatus(
    id: string,
    syncStatus: 'synced' | 'pending' | 'failed',
    syncMessage?: string
  ): Promise<DeprecationExtension | null> {
    const now = new Date().toISOString();
    const sql = `
      UPDATE deprecation_extensions
      SET sync_status = ?, sync_message = ?, sync_at = ?, updated_at = ?
      WHERE id = ?
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [syncStatus, syncMessage || null, now, now, id], async (err) => {
        if (err) reject(err);
        else {
          const updated = await this.getExtensionById(id);
          resolve(updated);
        }
      });
    });
  }

  async getExpiringExtensions(daysBefore: number = 7): Promise<DeprecationExtension[]> {
    const today = new Date();
    const targetDate = new Date(today.getTime() + daysBefore * 24 * 60 * 60 * 1000);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const sql = `
      SELECT * FROM deprecation_extensions
      WHERE status = ?
      AND extended_deprecation_date <= ?
      AND sync_status = 'synced'
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [ExtensionStatus.APPROVED, targetDateStr], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.rowToExtension(row)));
      });
    });
  }

  async getUnsyncedExtensions(): Promise<DeprecationExtension[]> {
    const sql = `
      SELECT * FROM deprecation_extensions
      WHERE status = ?
      AND sync_status != 'synced'
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [ExtensionStatus.APPROVED], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.rowToExtension(row)));
      });
    });
  }

  private rowToExtension(row: any): DeprecationExtension {
    return {
      id: row.id,
      apiName: row.api_name,
      apiPath: row.api_path,
      caller: row.caller,
      originalDeprecationDate: row.original_deprecation_date,
      extendedDeprecationDate: row.extended_deprecation_date,
      reason: row.reason,
      contactPerson: row.contact_person,
      contactEmail: row.contact_email,
      status: row.status as ExtensionStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      syncStatus: row.sync_status as 'synced' | 'pending' | 'failed',
      syncMessage: row.sync_message,
      syncAt: row.sync_at
    };
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const db = new Database();
