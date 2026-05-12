import { v4 as uuidv4 } from 'uuid';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';

export class Database {
  private static instance: Database;
  private db: sqlite3.Database;

  private constructor() {
    const dbPath = process.env.DB_PATH || ':memory:';
    this.db = new sqlite3.Database(dbPath);
    this.initialize();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public getDb(): sqlite3.Database {
    return this.db;
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  public get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  public all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  public exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private initialize(): void {
    const createTables = `
      CREATE TABLE IF NOT EXISTS equipment (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        location TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'RUNNING',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS check_template (
        id TEXT PRIMARY KEY,
        equipment_id TEXT NOT NULL,
        check_type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id)
      );

      CREATE TABLE IF NOT EXISTS check_item (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        name TEXT NOT NULL,
        item_type TEXT NOT NULL DEFAULT 'NORMAL',
        standard TEXT NOT NULL,
        method TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES check_template(id)
      );

      CREATE TABLE IF NOT EXISTS shift_inspection (
        id TEXT PRIMARY KEY,
        idempotent_key TEXT UNIQUE,
        equipment_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        shift TEXT NOT NULL,
        shift_date TEXT NOT NULL,
        inspector_id TEXT NOT NULL,
        inspector_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        start_time TEXT,
        end_time TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id),
        FOREIGN KEY (template_id) REFERENCES check_template(id)
      );

      CREATE INDEX IF NOT EXISTS idx_shift_inspection_eq_shift ON shift_inspection(equipment_id, shift_date, shift);

      CREATE TABLE IF NOT EXISTS inspection_item_result (
        id TEXT PRIMARY KEY,
        inspection_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        standard TEXT NOT NULL,
        actual_value TEXT,
        is_normal INTEGER NOT NULL,
        remark TEXT,
        checked_at TEXT NOT NULL,
        checked_by TEXT NOT NULL,
        FOREIGN KEY (inspection_id) REFERENCES shift_inspection(id),
        FOREIGN KEY (item_id) REFERENCES check_item(id)
      );

      CREATE TABLE IF NOT EXISTS exception_record (
        id TEXT PRIMARY KEY,
        idempotent_key TEXT UNIQUE,
        inspection_id TEXT,
        item_result_id TEXT,
        equipment_id TEXT NOT NULL,
        item_id TEXT,
        item_name TEXT,
        item_type TEXT,
        description TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'MEDIUM',
        reporter_id TEXT NOT NULL,
        reporter_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DETECTED',
        detected_at TEXT NOT NULL,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS downtime_record (
        id TEXT PRIMARY KEY,
        idempotent_key TEXT UNIQUE,
        equipment_id TEXT NOT NULL,
        exception_id TEXT,
        inspection_id TEXT,
        reason TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_minutes INTEGER,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'SCHEDULED',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS maintenance_assignment (
        id TEXT PRIMARY KEY,
        idempotent_key TEXT UNIQUE,
        exception_id TEXT NOT NULL,
        equipment_id TEXT NOT NULL,
        assignee_id TEXT NOT NULL,
        assignee_name TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'MEDIUM',
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ASSIGNED',
        assigned_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        result TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recheck_record (
        id TEXT PRIMARY KEY,
        idempotent_key TEXT UNIQUE,
        exception_id TEXT NOT NULL,
        inspection_id TEXT,
        maintenance_id TEXT,
        equipment_id TEXT NOT NULL,
        rechecker_id TEXT NOT NULL,
        rechecker_name TEXT NOT NULL,
        result TEXT NOT NULL,
        remark TEXT,
        rechecked_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS history_record (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        changes TEXT,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        reason TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_history_entity ON history_record(entity_type, entity_id);
    `;

    this.db.exec(createTables);
  }

  public generateId(): string {
    return uuidv4();
  }

  public now(): string {
    return new Date().toISOString();
  }
}

export const db = Database.getInstance();
