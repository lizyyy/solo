import { Database, RunResult } from 'sqlite3';
import { db } from '../config/database';

export const runQuery = (sql: string, params: any[] = []): Promise<RunResult> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

export const getOne = <T>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
};

export const getAll = <T>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};

export const beginTransaction = async (): Promise<void> => {
  await runQuery('BEGIN TRANSACTION');
};

export const commitTransaction = async (): Promise<void> => {
  await runQuery('COMMIT');
};

export const rollbackTransaction = async (): Promise<void> => {
  await runQuery('ROLLBACK');
};