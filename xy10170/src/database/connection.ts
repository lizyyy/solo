import * as sqlite3 from 'sqlite3';
import * as fs from 'fs-extra';
import config from '../config';
import { SCHEMA_SQL } from './schema';
import { DatabaseError } from '../utils/errors';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db: sqlite3.Database | null = null;

  private constructor() {}

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async init(): Promise<void> {
    await fs.ensureDir(config.dataDir);
    await fs.ensureDir(config.reportDir);
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(config.dbPath, (err) => {
        if (err) {
          reject(new DatabaseError('无法打开数据库', err));
        } else {
          this.db!.exec(SCHEMA_SQL, (schemaErr) => {
            if (schemaErr) {
              reject(new DatabaseError('初始化数据库 schema 失败', schemaErr));
            } else {
              resolve();
            }
          });
        }
      });
    });
  }

  getDb(): sqlite3.Database {
    if (!this.db) {
      throw new DatabaseError('数据库未初始化，请先运行 init 命令');
    }
    return this.db;
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID: string; changes: number }> {
    return new Promise((resolve, reject) => {
      const self = this;
      this.getDb().run(sql, params, function(err) {
        if (err) {
          reject(new DatabaseError('数据库查询失败', err));
        } else {
          const stmt = this as any;
          resolve({ 
            lastID: stmt.lastID ? String(stmt.lastID) : '', 
            changes: stmt.changes || 0 
          });
        }
      });
    });
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.getDb().get(sql, params, (err, row) => {
        if (err) {
          reject(new DatabaseError('数据库查询失败', err));
        } else {
          resolve(row as T);
        }
      });
    });
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.getDb().all(sql, params, (err, rows) => {
        if (err) {
          reject(new DatabaseError('数据库查询失败', err));
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  async exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getDb().exec(sql, (err) => {
        if (err) {
          reject(new DatabaseError('数据库执行失败', err));
        } else {
          resolve();
        }
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(new DatabaseError('关闭数据库失败', err));
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

export default DatabaseConnection.getInstance();
