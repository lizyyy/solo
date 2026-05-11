import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js'
import path from 'path'
import { app } from 'electron'
import * as fs from 'fs'

let sqlJs: SqlJsStatic
let database: SqlJsDatabase
let dbFilePath: string

export async function initSqlJsModule(): Promise<SqlJsStatic> {
  if (!sqlJs) {
    sqlJs = await initSqlJs({
      locateFile: (file: string) => {
        try {
          return path.join(__dirname, file)
        } catch {
          return file
        }
      }
    })
  }
  return sqlJs
}

export function getDbFilePath(): string {
  if (dbFilePath) {
    return dbFilePath
  }
  try {
    dbFilePath = path.join(app.getPath('userData'), 'device-management.db')
  } catch {
    dbFilePath = path.join(process.cwd(), 'device-management.db')
  }
  return dbFilePath
}

export function saveDatabaseToDisk(): void {
  if (database) {
    const data = database.export()
    const buffer = Buffer.from(data)
    try {
      const filePath = getDbFilePath()
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, buffer)
    } catch (e) {
    }
  }
}

export async function getDatabase(): Promise<SqlJsDatabase> {
  if (!database) {
    const SQL = await initSqlJsModule()

    let existingDbPath = getDbFilePath()

    if (fs.existsSync(existingDbPath)) {
      try {
        const fileBuffer = fs.readFileSync(existingDbPath)
        database = new SQL.Database(fileBuffer)
      } catch {
        database = new SQL.Database()
      }
    } else {
      database = new SQL.Database()
    }
  }
  return database
}

export function closeDatabase(): void {
  if (database) {
    saveDatabaseToDisk()
    database.close()
    database = null as any
  }
}

export async function initDatabase(): Promise<void> {
  const db = await getDatabase()
  
  const initSql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      device_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      model TEXT,
      serial_number TEXT,
      status TEXT NOT NULL,
      location TEXT,
      description TEXT,
      current_holder TEXT,
      current_holder_name TEXT,
      borrowed_at TEXT,
      expected_return_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS borrow_records (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      device_code TEXT NOT NULL,
      borrower_id TEXT NOT NULL,
      borrower_name TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      borrowed_at TEXT NOT NULL,
      expected_return_at TEXT,
      returned_at TEXT,
      status TEXT NOT NULL,
      purpose TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_history (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_by_name TEXT NOT NULL,
      change_type TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      details TEXT NOT NULL,
      success INTEGER NOT NULL,
      error_message TEXT,
      duration INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS failed_operations (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      details TEXT NOT NULL,
      error_message TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL,
      last_attempt_at TEXT NOT NULL,
      next_retry_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batch_operations (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      total_count INTEGER NOT NULL,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      results TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_by_name TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
    CREATE INDEX IF NOT EXISTS idx_devices_code ON devices(device_code);
    CREATE INDEX IF NOT EXISTS idx_borrow_records_device ON borrow_records(device_id);
    CREATE INDEX IF NOT EXISTS idx_borrow_records_status ON borrow_records(status);
    CREATE INDEX IF NOT EXISTS idx_history_device ON device_history(device_id);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_failed_status ON failed_operations(status);
  `

  db.run(initSql)
  saveDatabaseToDisk()
}

export async function exec(sql: string, params: any[] = []): void {
  const db = await getDatabase()
  db.run(sql, params)
  saveDatabaseToDisk()
}

export async function run(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  const db = await getDatabase()
  db.run(sql, params)
  saveDatabaseToDisk()
  return {
    changes: db.getRowsModified(),
    lastInsertRowid: 0
  }
}

export async function get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const db = await getDatabase()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row as T
  } else {
    stmt.free()
    return null
  }
}

export async function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDatabase()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return results
}

export async function beginTransaction(): Promise<void> {
  await exec('BEGIN TRANSACTION')
}

export async function commitTransaction(): Promise<void> {
  await exec('COMMIT')
}

export async function rollbackTransaction(): Promise<void> {
  await exec('ROLLBACK')
}

export function flushDatabase(): void {
  saveDatabaseToDisk()
}