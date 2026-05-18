import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);

export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS skip_applications (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          task_name TEXT NOT NULL,
          skip_reason TEXT NOT NULL,
          impact_scope TEXT NOT NULL,
          rerun_plan TEXT NOT NULL,
          applicant TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS approval_records (
          id TEXT PRIMARY KEY,
          skip_application_id TEXT NOT NULL,
          approver TEXT NOT NULL,
          approval_result TEXT NOT NULL,
          approval_comment TEXT,
          approved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (skip_application_id) REFERENCES skip_applications(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS workflow_records (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          task_name TEXT NOT NULL,
          status TEXT NOT NULL,
          is_skipped INTEGER DEFAULT 0,
          skip_application_id TEXT,
          downstream_tasks TEXT,
          data_completeness TEXT,
          started_at DATETIME,
          completed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (skip_application_id) REFERENCES skip_applications(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS rerun_records (
          id TEXT PRIMARY KEY,
          skip_application_id TEXT NOT NULL,
          workflow_record_id TEXT,
          rerun_task_id TEXT NOT NULL,
          rerun_task_name TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at DATETIME,
          completed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (skip_application_id) REFERENCES skip_applications(id),
          FOREIGN KEY (workflow_record_id) REFERENCES workflow_records(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export default db;