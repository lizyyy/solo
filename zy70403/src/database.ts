import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'audit-data.db');

export interface Certificate {
  id?: number;
  certNumber: string;
  applicant: string;
  department: string;
  issueDate: string;
  expireDate: string;
  status: 'issued' | 'revoked' | 'expired';
  issuer: string;
  batchId: string;
  isOffline: boolean;
  originalData: string;
}

export interface Whitelist {
  id?: number;
  employeeId: string;
  employeeName: string;
  department: string;
  reason: string;
  startDate: string;
  endDate: string;
  isTemporary: boolean;
  isRevoked: boolean;
  operator: string;
  batchId: string;
  createdAt: string;
}

export interface AnomalySample {
  id?: number;
  sampleId: string;
  riskType: string;
  description: string;
  source: string;
  discoveredAt: string;
  discoveredBy: string;
  status: 'pending' | 'reviewed' | 'resolved';
  originalData: string;
  relatedBatchId?: string;
}

export interface BusReservation {
  id?: number;
  rowNumber: number;
  employeeId: string;
  employeeName: string;
  department: string;
  route: string;
  reservationDate: string;
  manualNote: string;
  batchId: string;
  importedAt: string;
}

export interface OperationLog {
  id?: number;
  operationType: string;
  operator: string;
  batchId: string;
  affectedCount: number;
  description: string;
  executedAt: string;
  isRollback: boolean;
  rollbackFrom?: number;
}

export class AuditDatabase {
  private db: sqlite3.Database;
  private initPromise: Promise<void>;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.initPromise = this.initTables();
  }

  private async runAsync(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  private async allAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  private async initTables(): Promise<void> {
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        certNumber TEXT UNIQUE NOT NULL,
        applicant TEXT NOT NULL,
        department TEXT NOT NULL,
        issueDate TEXT NOT NULL,
        expireDate TEXT NOT NULL,
        status TEXT NOT NULL,
        issuer TEXT NOT NULL,
        batchId TEXT NOT NULL,
        isOffline BOOLEAN NOT NULL DEFAULT 0,
        originalData TEXT NOT NULL
      )
    `);

    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS whitelists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId TEXT NOT NULL,
        employeeName TEXT NOT NULL,
        department TEXT NOT NULL,
        reason TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        isTemporary BOOLEAN NOT NULL DEFAULT 0,
        isRevoked BOOLEAN NOT NULL DEFAULT 0,
        operator TEXT NOT NULL,
        batchId TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )
    `);

    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS anomaly_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sampleId TEXT UNIQUE NOT NULL,
        riskType TEXT NOT NULL,
        description TEXT NOT NULL,
        source TEXT NOT NULL,
        discoveredAt TEXT NOT NULL,
        discoveredBy TEXT NOT NULL,
        status TEXT NOT NULL,
        originalData TEXT NOT NULL,
        relatedBatchId TEXT
      )
    `);

    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS bus_reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rowNumber INTEGER NOT NULL,
        employeeId TEXT NOT NULL,
        employeeName TEXT NOT NULL,
        department TEXT NOT NULL,
        route TEXT NOT NULL,
        reservationDate TEXT NOT NULL,
        manualNote TEXT,
        batchId TEXT NOT NULL,
        importedAt TEXT NOT NULL
      )
    `);

    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operationType TEXT NOT NULL,
        operator TEXT NOT NULL,
        batchId TEXT NOT NULL,
        affectedCount INTEGER NOT NULL,
        description TEXT NOT NULL,
        executedAt TEXT NOT NULL,
        isRollback BOOLEAN NOT NULL DEFAULT 0,
        rollbackFrom INTEGER
      )
    `);

    await this.runAsync('CREATE INDEX IF NOT EXISTS idx_certs_batch ON certificates(batchId)');
    await this.runAsync('CREATE INDEX IF NOT EXISTS idx_whitelist_batch ON whitelists(batchId)');
    await this.runAsync('CREATE INDEX IF NOT EXISTS idx_anomaly_risk ON anomaly_samples(riskType)');
    await this.runAsync('CREATE INDEX IF NOT EXISTS idx_anomaly_batch ON anomaly_samples(relatedBatchId)');
    await this.runAsync('CREATE INDEX IF NOT EXISTS idx_bus_batch ON bus_reservations(batchId)');
    await this.runAsync('CREATE INDEX IF NOT EXISTS idx_logs_batch ON operation_logs(batchId)');
    await this.runAsync('CREATE INDEX IF NOT EXISTS idx_logs_operator ON operation_logs(operator)');
  }

  async waitReady(): Promise<void> {
    await this.initPromise;
  }

  async insertCertificate(cert: Certificate): Promise<void> {
    await this.runAsync(
      `INSERT INTO certificates 
       (certNumber, applicant, department, issueDate, expireDate, status, issuer, batchId, isOffline, originalData)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cert.certNumber, cert.applicant, cert.department, cert.issueDate, cert.expireDate,
       cert.status, cert.issuer, cert.batchId, cert.isOffline ? 1 : 0, cert.originalData]
    );
  }

  async insertWhitelist(wl: Whitelist): Promise<void> {
    await this.runAsync(
      `INSERT INTO whitelists 
       (employeeId, employeeName, department, reason, startDate, endDate, isTemporary, isRevoked, operator, batchId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [wl.employeeId, wl.employeeName, wl.department, wl.reason, wl.startDate, wl.endDate,
       wl.isTemporary ? 1 : 0, wl.isRevoked ? 1 : 0, wl.operator, wl.batchId, wl.createdAt]
    );
  }

  async insertAnomalySample(sample: AnomalySample): Promise<void> {
    await this.runAsync(
      `INSERT INTO anomaly_samples 
       (sampleId, riskType, description, source, discoveredAt, discoveredBy, status, originalData, relatedBatchId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sample.sampleId, sample.riskType, sample.description, sample.source,
       sample.discoveredAt, sample.discoveredBy, sample.status, sample.originalData, sample.relatedBatchId]
    );
  }

  async insertBusReservation(res: BusReservation): Promise<void> {
    await this.runAsync(
      `INSERT INTO bus_reservations 
       (rowNumber, employeeId, employeeName, department, route, reservationDate, manualNote, batchId, importedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [res.rowNumber, res.employeeId, res.employeeName, res.department, res.route,
       res.reservationDate, res.manualNote, res.batchId, res.importedAt]
    );
  }

  async insertOperationLog(log: OperationLog): Promise<number> {
    const result = await this.runAsync(
      `INSERT INTO operation_logs 
       (operationType, operator, batchId, affectedCount, description, executedAt, isRollback, rollbackFrom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [log.operationType, log.operator, log.batchId, log.affectedCount,
       log.description, log.executedAt, log.isRollback ? 1 : 0, log.rollbackFrom]
    );
    return result.lastID as number;
  }

  async getCertificatesByBatch(batchId: string): Promise<Certificate[]> {
    return this.allAsync<Certificate>('SELECT * FROM certificates WHERE batchId = ?', [batchId]);
  }

  async getWhitelists(options: { isTemporary?: boolean; isRevoked?: boolean } = {}): Promise<Whitelist[]> {
    let sql = 'SELECT * FROM whitelists WHERE 1=1';
    const params: any[] = [];
    
    if (options.isTemporary !== undefined) {
      sql += ' AND isTemporary = ?';
      params.push(options.isTemporary ? 1 : 0);
    }
    if (options.isRevoked !== undefined) {
      sql += ' AND isRevoked = ?';
      params.push(options.isRevoked ? 1 : 0);
    }
    
    return this.allAsync<Whitelist>(sql, params);
  }

  async getAnomalySamples(options: { riskType?: string; status?: string } = {}): Promise<AnomalySample[]> {
    let sql = 'SELECT * FROM anomaly_samples WHERE 1=1';
    const params: any[] = [];
    
    if (options.riskType) {
      sql += ' AND riskType = ?';
      params.push(options.riskType);
    }
    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }
    
    return this.allAsync<AnomalySample>(sql, params);
  }

  async getBusReservationsByBatch(batchId: string): Promise<BusReservation[]> {
    return this.allAsync<BusReservation>(
      'SELECT * FROM bus_reservations WHERE batchId = ? ORDER BY rowNumber',
      [batchId]
    );
  }

  async getOperationLogs(options: { batchId?: string; operator?: string; operationType?: string } = {}): Promise<OperationLog[]> {
    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    const params: any[] = [];
    
    if (options.batchId) {
      sql += ' AND batchId = ?';
      params.push(options.batchId);
    }
    if (options.operator) {
      sql += ' AND operator = ?';
      params.push(options.operator);
    }
    if (options.operationType) {
      sql += ' AND operationType = ?';
      params.push(options.operationType);
    }
    
    sql += ' ORDER BY executedAt DESC';
    return this.allAsync<OperationLog>(sql, params);
  }

  async getOfflineCertificates(): Promise<Certificate[]> {
    return this.allAsync<Certificate>('SELECT * FROM certificates WHERE isOffline = 1');
  }

  async getUnrevokedTemporaryWhitelist(): Promise<Whitelist[]> {
    return this.allAsync<Whitelist>('SELECT * FROM whitelists WHERE isTemporary = 1 AND isRevoked = 0');
  }

  async revokeWhitelistById(id: number): Promise<void> {
    await this.runAsync('UPDATE whitelists SET isRevoked = 1 WHERE id = ?', [id]);
  }

  async deleteCertificatesByBatch(batchId: string): Promise<number> {
    const result = await this.runAsync('DELETE FROM certificates WHERE batchId = ?', [batchId]);
    return result.changes || 0;
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

export const db = new AuditDatabase();
