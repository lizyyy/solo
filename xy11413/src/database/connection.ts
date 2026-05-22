import sqlite3 from 'sqlite3';
import { CREATE_TABLES_SQL } from './schema';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'verification.db');

let dbInstance: sqlite3.Database | null = null;

export const getDbConnection = (): sqlite3.Database => {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        throw err;
      }
      console.log('已连接到 SQLite 数据库');
    });
    dbInstance.serialize(() => {
      dbInstance!.exec(CREATE_TABLES_SQL, (err) => {
        if (err) {
          console.error('表创建失败:', err.message);
          throw err;
        }
        console.log('数据库表初始化完成');
      });
    });
  }
  return dbInstance;
};

export const closeDbConnection = (): void => {
  if (dbInstance) {
    dbInstance.close((err) => {
      if (err) {
        console.error('关闭数据库失败:', err.message);
      } else {
        console.log('数据库连接已关闭');
      }
    });
    dbInstance = null;
  }
};

export const runQuery = <T>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const runInsert = (sql: string, params: any[] = []): Promise<number> => {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.run(sql, params, function(err: Error | null) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

export const runUpdate = (sql: string, params: any[] = []): Promise<number> => {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.run(sql, params, function(err: Error | null) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};
