import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_PATH = path.join(DATA_DIR, 'wave-tank.db')

let SQL: SqlJsStatic | null = null
let db: Database | null = null

async function initSql(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) =>
        path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
    })
  }
  return SQL
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

export async function getDb(): Promise<Database> {
  if (!db) {
    const SQL = await initSql()
    ensureDataDir()
    let dbFile: Uint8Array | null = null
    if (fs.existsSync(DB_PATH)) {
      dbFile = fs.readFileSync(DB_PATH)
    }
    db = dbFile ? new SQL.Database(dbFile) : new SQL.Database()
    migrate(db)
    saveDb()
  }
  return db
}

export function saveDb() {
  if (db) {
    ensureDataDir()
    const data = db.export()
    fs.writeFileSync(DB_PATH, Buffer.from(data))
  }
}

function migrate(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS batch_imports (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      total_count INTEGER NOT NULL DEFAULT 0,
      mixed_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      sensor_id TEXT NOT NULL,
      original_line_no INTEGER NOT NULL,
      temperature_value REAL NOT NULL,
      temperature_unit TEXT NOT NULL CHECK (temperature_unit IN ('C', 'K')),
      corrected_value REAL,
      corrected_unit TEXT CHECK (corrected_unit IN ('C', 'K')),
      status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'mixed_unit', 'anomaly', 'confirmed', 'rolled_back')),
      credibility TEXT CHECK (credibility IN ('sensor_trusted', 'photo_trusted', 'pending_confirmation')),
      source TEXT NOT NULL DEFAULT 'sensor_original' CHECK (source IN ('sensor_original', 'photo_corrected', 'coach_confirmed', 'rolled_back')),
      note TEXT,
      batch_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('import', 'review', 'confirm', 'rollback', 'edit')),
      operator_role TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      description TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_records_status ON records(status)')
  db.run('CREATE INDEX IF NOT EXISTS idx_records_sensor_id ON records(sensor_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_records_batch_id ON records(batch_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_photos_record_id ON photos(record_id)')
  saveDb()
}

export function persistDb() {
  saveDb()
}

export function closeDb() {
  if (db) {
    saveDb()
    db.close()
    db = null
  }
}
