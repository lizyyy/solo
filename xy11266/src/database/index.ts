import sqlite3 from 'sqlite3';
import path from 'path';
import {
  CallRecord,
  AnomalyRecord,
  ErrorRecord,
  SensitiveWord,
  ImportHistory,
  QueryFilters,
} from '../types';

const DB_PATH = path.join(process.cwd(), 'data', 'qa_inspection.db');

export class Database {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.initTables();
  }

  private initTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS call_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            callId TEXT UNIQUE NOT NULL,
            agentName TEXT NOT NULL,
            agentId TEXT NOT NULL,
            callDate TEXT NOT NULL,
            callDuration INTEGER NOT NULL,
            transcript TEXT NOT NULL,
            summary TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS anomaly_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recordId INTEGER NOT NULL,
            anomalyType TEXT NOT NULL,
            description TEXT NOT NULL,
            severity TEXT NOT NULL,
            position TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (recordId) REFERENCES call_records(id) ON DELETE CASCADE
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS error_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sourceFile TEXT NOT NULL,
            originalPosition TEXT NOT NULL,
            rawContent TEXT NOT NULL,
            errorType TEXT NOT NULL,
            errorMessage TEXT NOT NULL,
            suggestion TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'unresolved',
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            resolvedAt TEXT
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS sensitive_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT UNIQUE NOT NULL,
            category TEXT NOT NULL,
            severity TEXT NOT NULL,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS import_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fileName TEXT NOT NULL,
            fileType TEXT NOT NULL,
            totalRecords INTEGER NOT NULL,
            successCount INTEGER NOT NULL,
            errorCount INTEGER NOT NULL,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async insertCallRecord(record: Omit<CallRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO call_records (callId, agentName, agentId, callDate, callDuration, transcript, summary, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        record.callId,
        record.agentName,
        record.agentId,
        record.callDate,
        record.callDuration,
        record.transcript,
        record.summary || null,
        record.status,
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve(this.lastID as number);
        }
      );
      stmt.finalize();
    });
  }

  async updateCallRecordStatus(id: number, status: string, summary?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE call_records 
        SET status = ?, summary = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(status, summary || null, id, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
      stmt.finalize();
    });
  }

  async insertAnomalyRecord(record: Omit<AnomalyRecord, 'id' | 'createdAt'>): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO anomaly_records (recordId, anomalyType, description, severity, position)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(
        record.recordId,
        record.anomalyType,
        record.description,
        record.severity,
        record.position || null,
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve(this.lastID as number);
        }
      );
      stmt.finalize();
    });
  }

  async insertErrorRecord(record: Omit<ErrorRecord, 'id' | 'createdAt' | 'resolvedAt'>): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO error_records (sourceFile, originalPosition, rawContent, errorType, errorMessage, suggestion, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        record.sourceFile,
        record.originalPosition,
        record.rawContent,
        record.errorType,
        record.errorMessage,
        record.suggestion,
        record.status,
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve(this.lastID as number);
        }
      );
      stmt.finalize();
    });
  }

  async insertSensitiveWord(word: Omit<SensitiveWord, 'id' | 'createdAt'>): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO sensitive_words (word, category, severity)
        VALUES (?, ?, ?)
      `);
      stmt.run(word.word, word.category, word.severity, function(this: sqlite3.RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID as number);
      });
      stmt.finalize();
    });
  }

  async getAllSensitiveWords(): Promise<SensitiveWord[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM sensitive_words', [], (err: Error | null, rows: SensitiveWord[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async insertImportHistory(history: Omit<ImportHistory, 'id' | 'createdAt'>): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO import_history (fileName, fileType, totalRecords, successCount, errorCount)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(
        history.fileName,
        history.fileType,
        history.totalRecords,
        history.successCount,
        history.errorCount,
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve(this.lastID as number);
        }
      );
      stmt.finalize();
    });
  }

  async queryCallRecords(filters: QueryFilters = {}): Promise<(CallRecord & { anomalies: AnomalyRecord[] })[]> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT cr.*, 
               ar.id as ar_id, ar.anomalyType, ar.description, ar.severity, ar.position, ar.createdAt as ar_createdAt
        FROM call_records cr
        LEFT JOIN anomaly_records ar ON cr.id = ar.recordId
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters.agentName) {
        query += ' AND cr.agentName LIKE ?';
        params.push(`%${filters.agentName}%`);
      }

      if (filters.startDate) {
        query += ' AND cr.callDate >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND cr.callDate <= ?';
        params.push(filters.endDate);
      }

      if (filters.status) {
        query += ' AND cr.status = ?';
        params.push(filters.status);
      }

      if (filters.anomalyType) {
        query += ' AND ar.anomalyType = ?';
        params.push(filters.anomalyType);
      }

      query += ' ORDER BY cr.callDate DESC, cr.id DESC';

      this.db.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const recordMap = new Map<number, CallRecord & { anomalies: AnomalyRecord[] }>();
        
        rows.forEach(row => {
          if (!recordMap.has(row.id)) {
            recordMap.set(row.id, {
              id: row.id,
              callId: row.callId,
              agentName: row.agentName,
              agentId: row.agentId,
              callDate: row.callDate,
              callDuration: row.callDuration,
              transcript: row.transcript,
              summary: row.summary,
              status: row.status,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              anomalies: []
            });
          }

          if (row.ar_id) {
            recordMap.get(row.id)!.anomalies.push({
              id: row.ar_id,
              recordId: row.id,
              anomalyType: row.anomalyType,
              description: row.description,
              severity: row.severity,
              position: row.position,
              createdAt: row.ar_createdAt
            });
          }
        });

        resolve(Array.from(recordMap.values()));
      });
    });
  }

  async getErrorRecords(status?: string): Promise<ErrorRecord[]> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM error_records';
      const params: any[] = [];

      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }

      query += ' ORDER BY createdAt DESC';

      this.db.all(query, params, (err: Error | null, rows: ErrorRecord[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getImportHistory(): Promise<ImportHistory[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM import_history ORDER BY createdAt DESC', [], (err: Error | null, rows: ImportHistory[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const db = new Database();
