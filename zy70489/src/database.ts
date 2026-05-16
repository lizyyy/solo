import sqlite3 from 'sqlite3';
import { ProbeResult, PurchaseInquiry, ProcessingConclusion, MaterialSummary, QueryFilter } from './types';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = './probe.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS probe_results (
          id TEXT PRIMARY KEY,
          dependencyId TEXT NOT NULL,
          dependencyName TEXT NOT NULL,
          status TEXT NOT NULL,
          errorType TEXT,
          errorMessage TEXT,
          responseTime INTEGER,
          timestamp INTEGER NOT NULL,
          rawData TEXT
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS purchase_inquiries (
          id TEXT PRIMARY KEY,
          inquiryNo TEXT NOT NULL UNIQUE,
          supplier TEXT NOT NULL,
          materialName TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unitPrice REAL NOT NULL,
          totalPrice REAL NOT NULL,
          status TEXT NOT NULL,
          permissionTicket TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS processing_conclusions (
          id TEXT PRIMARY KEY,
          inquiryId TEXT NOT NULL,
          conclusion TEXT NOT NULL,
          reason TEXT NOT NULL,
          operator TEXT,
          isManualCorrection INTEGER NOT NULL,
          correctionRemark TEXT,
          previousConclusion TEXT,
          previousReason TEXT,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY (inquiryId) REFERENCES purchase_inquiries(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS material_summaries (
          id TEXT PRIMARY KEY,
          inquiryId TEXT NOT NULL UNIQUE,
          summary TEXT NOT NULL,
          permissionTicketChanges TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          FOREIGN KEY (inquiryId) REFERENCES purchase_inquiries(id)
        )
      `);
    });
  }

  async insertProbeResult(result: ProbeResult): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO probe_results (id, dependencyId, dependencyName, status, errorType, errorMessage, responseTime, timestamp, rawData)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.id,
          result.dependencyId,
          result.dependencyName,
          result.status,
          result.errorType,
          result.errorMessage,
          result.responseTime,
          result.timestamp,
          JSON.stringify(result.rawData)
        ],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async insertPurchaseInquiry(inquiry: PurchaseInquiry): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO purchase_inquiries (id, inquiryNo, supplier, materialName, quantity, unitPrice, totalPrice, status, permissionTicket, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inquiry.id,
          inquiry.inquiryNo,
          inquiry.supplier,
          inquiry.materialName,
          inquiry.quantity,
          inquiry.unitPrice,
          inquiry.totalPrice,
          inquiry.status,
          inquiry.permissionTicket,
          inquiry.createdAt,
          inquiry.updatedAt
        ],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async updatePurchaseInquiry(inquiry: PurchaseInquiry): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE purchase_inquiries 
         SET status = ?, permissionTicket = ?, updatedAt = ?
         WHERE id = ?`,
        [inquiry.status, inquiry.permissionTicket, inquiry.updatedAt, inquiry.id],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async getPurchaseInquiry(id: string): Promise<PurchaseInquiry | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM purchase_inquiries WHERE id = ?`,
        [id],
        (err, row: any) => {
          if (err) reject(err);
          resolve(row as PurchaseInquiry | undefined);
        }
      );
    });
  }

  async getAllPurchaseInquiries(): Promise<PurchaseInquiry[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM purchase_inquiries ORDER BY createdAt DESC`,
        [],
        (err, rows: any[]) => {
          if (err) reject(err);
          resolve(rows as PurchaseInquiry[]);
        }
      );
    });
  }

  async insertProcessingConclusion(conclusion: ProcessingConclusion): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO processing_conclusions (id, inquiryId, conclusion, reason, operator, isManualCorrection, correctionRemark, previousConclusion, previousReason, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conclusion.id,
          conclusion.inquiryId,
          conclusion.conclusion,
          conclusion.reason,
          conclusion.operator,
          conclusion.isManualCorrection ? 1 : 0,
          conclusion.correctionRemark,
          conclusion.previousConclusion,
          conclusion.previousReason,
          conclusion.createdAt
        ],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async getProcessingConclusions(inquiryId: string): Promise<ProcessingConclusion[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM processing_conclusions WHERE inquiryId = ? ORDER BY createdAt DESC`,
        [inquiryId],
        (err, rows: any[]) => {
          if (err) reject(err);
          resolve(rows.map(r => ({ ...r, isManualCorrection: r.isManualCorrection === 1 })) as ProcessingConclusion[]);
        }
      );
    });
  }

  async insertMaterialSummary(summary: MaterialSummary): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO material_summaries (id, inquiryId, summary, permissionTicketChanges, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          summary.id,
          summary.inquiryId,
          summary.summary,
          JSON.stringify(summary.permissionTicketChanges),
          summary.createdAt,
          summary.updatedAt
        ],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async updateMaterialSummary(summary: MaterialSummary): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE material_summaries 
         SET summary = ?, permissionTicketChanges = ?, updatedAt = ?
         WHERE inquiryId = ?`,
        [summary.summary, JSON.stringify(summary.permissionTicketChanges), summary.updatedAt, summary.inquiryId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async getMaterialSummary(inquiryId: string): Promise<MaterialSummary | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM material_summaries WHERE inquiryId = ?`,
        [inquiryId],
        (err, row: any) => {
          if (err) reject(err);
          if (row) {
            resolve({
              ...row,
              permissionTicketChanges: row.permissionTicketChanges ? JSON.parse(row.permissionTicketChanges) : undefined
            } as MaterialSummary);
          } else {
            resolve(undefined);
          }
        }
      );
    });
  }

  async queryProbeResults(filter: QueryFilter): Promise<ProbeResult[]> {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM probe_results WHERE 1=1`;
      const params: any[] = [];

      if (filter.status && filter.status !== 'all') {
        query += ` AND status = ?`;
        params.push(filter.status);
      }
      if (filter.dependencyId) {
        query += ` AND dependencyId = ?`;
        params.push(filter.dependencyId);
      }
      if (filter.startTime) {
        query += ` AND timestamp >= ?`;
        params.push(filter.startTime);
      }
      if (filter.endTime) {
        query += ` AND timestamp <= ?`;
        params.push(filter.endTime);
      }

      query += ` ORDER BY timestamp DESC`;

      this.db.all(query, params, (err, rows: any[]) => {
        if (err) reject(err);
        resolve(rows.map(r => ({ ...r, rawData: r.rawData ? JSON.parse(r.rawData) : undefined })) as ProbeResult[]);
      });
    });
  }

  async getAllMaterialSummaries(): Promise<MaterialSummary[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM material_summaries ORDER BY createdAt DESC`,
        [],
        (err, rows: any[]) => {
          if (err) reject(err);
          resolve(rows.map(r => ({
            ...r,
            permissionTicketChanges: r.permissionTicketChanges ? JSON.parse(r.permissionTicketChanges) : undefined
          })) as MaterialSummary[]);
        }
      );
    });
  }

  close(): void {
    this.db.close();
  }
}
