import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class DatabaseService {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  generateId(): string {
    return uuidv4();
  }

  now(): string {
    return new Date().toISOString();
  }

  async checkIdempotency(requestData: any): Promise<any | null> {
    const requestHash = crypto
      .createHash('md5')
      .update(JSON.stringify(requestData))
      .digest('hex');
    
    const existing = await this.get(
      'SELECT response FROM idempotency_keys WHERE requestHash = ?',
      [requestHash]
    );
    
    if (existing) {
      return JSON.parse(existing.response);
    }
    return null;
  }

  async saveIdempotency(requestData: any, response: any): Promise<void> {
    const requestHash = crypto
      .createHash('md5')
      .update(JSON.stringify(requestData))
      .digest('hex');
    
    await this.run(
      'INSERT INTO idempotency_keys (id, requestHash, response, createdAt) VALUES (?, ?, ?, ?)',
      [this.generateId(), requestHash, JSON.stringify(response), this.now()]
    );
  }
}

export default DatabaseService;
