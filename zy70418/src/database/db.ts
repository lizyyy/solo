import sqlite3 from 'sqlite3';
import { createTables, insertSupplierDirectoryData } from './schema';

const dbPath = process.env.DB_PATH || './file_validation.db';

export const initDatabase = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.exec(createTables, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.exec(insertSupplierDirectoryData, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(db);
        });
      });
    });
  });
};

export const getDb = (): sqlite3.Database => {
  return new sqlite3.Database(dbPath);
};

export const runQuery = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const getQuery = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const allQuery = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};
