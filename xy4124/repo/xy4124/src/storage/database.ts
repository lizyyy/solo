import Database from 'better-sqlite3';
import { join } from 'path';

let dbInstance: Database.Database | null = null;

const SCHEMA_VERSION = 1;

export function getDatabasePath(): string {
  const envPath = process.env.DB_PATH;
  if (envPath) {
    return envPath;
  }
  return join(process.cwd(), 'data', 'cinema-guardian.db');
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbPath = getDatabasePath();
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initializeDatabase(dbInstance);
  }
  return dbInstance;
}

function initializeDatabase(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  
  if (currentVersion < SCHEMA_VERSION) {
    runMigrations(db, currentVersion);
  }
}

function runMigrations(db: Database.Database, currentVersion: number): void {
  if (currentVersion < 1) {
    migrateToV1(db);
  }
}

function migrateToV1(db: Database.Database): void {
  const transaction = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS film_versions (
        id TEXT PRIMARY KEY,
        film_id TEXT NOT NULL,
        film_title TEXT NOT NULL,
        version_id TEXT NOT NULL,
        version_name TEXT NOT NULL,
        audio_language TEXT NOT NULL,
        subtitle_language TEXT NOT NULL,
        subtitle_type TEXT NOT NULL,
        aspect_ratio TEXT NOT NULL,
        sound_format TEXT NOT NULL,
        runtime_minutes INTEGER NOT NULL,
        dcp_hash TEXT NOT NULL,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(film_id, version_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_film_versions_film_id ON film_versions(film_id);
      CREATE INDEX IF NOT EXISTS idx_film_versions_active ON film_versions(is_active);
      
      CREATE TABLE IF NOT EXISTS auditorium_devices (
        id TEXT PRIMARY KEY,
        auditorium_id TEXT NOT NULL UNIQUE,
        auditorium_name TEXT NOT NULL,
        seat_count INTEGER NOT NULL,
        supported_aspect_ratios TEXT NOT NULL,
        supported_sound_formats TEXT NOT NULL,
        status TEXT NOT NULL,
        status_reason TEXT,
        last_maintenance TEXT,
        next_maintenance TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_auditorium_devices_status ON auditorium_devices(status);
      CREATE INDEX IF NOT EXISTS idx_auditorium_devices_active ON auditorium_devices(is_active);
      
      CREATE TABLE IF NOT EXISTS kdms (
        id TEXT PRIMARY KEY,
        kdm_id TEXT NOT NULL UNIQUE,
        film_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        auditorium_id TEXT NOT NULL,
        validity_start TEXT NOT NULL,
        validity_end TEXT NOT NULL,
        cpl_id TEXT NOT NULL,
        issuer TEXT NOT NULL,
        issuer_org TEXT NOT NULL,
        content_title_text TEXT NOT NULL,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_kdms_film_version ON kdms(film_id, version_id);
      CREATE INDEX IF NOT EXISTS idx_kdms_auditorium ON kdms(auditorium_id);
      CREATE INDEX IF NOT EXISTS idx_kdms_validity ON kdms(validity_start, validity_end);
      CREATE INDEX IF NOT EXISTS idx_kdms_active ON kdms(is_active);
      
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL UNIQUE,
        film_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        auditorium_id TEXT NOT NULL,
        show_start TEXT NOT NULL,
        show_end TEXT NOT NULL,
        pre_show_minutes INTEGER NOT NULL DEFAULT 0,
        buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
        buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
        actual_end_time TEXT NOT NULL,
        notes TEXT,
        is_cancelled INTEGER NOT NULL DEFAULT 0,
        cancel_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_schedules_auditorium ON schedules(auditorium_id);
      CREATE INDEX IF NOT EXISTS idx_schedules_film ON schedules(film_id);
      CREATE INDEX IF NOT EXISTS idx_schedules_time ON schedules(show_start, show_end);
      
      CREATE TABLE IF NOT EXISTS projection_checks (
        id TEXT PRIMARY KEY,
        check_id TEXT NOT NULL UNIQUE,
        schedule_id TEXT NOT NULL,
        overall_status TEXT NOT NULL,
        checks TEXT NOT NULL,
        check_trigger TEXT NOT NULL,
        checked_by TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_projection_checks_schedule ON projection_checks(schedule_id);
      CREATE INDEX IF NOT EXISTS idx_projection_checks_status ON projection_checks(overall_status);
      CREATE INDEX IF NOT EXISTS idx_projection_checks_created ON projection_checks(created_at);
      
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        audit_id TEXT NOT NULL UNIQUE,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        actor TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        changes TEXT,
        old_values TEXT,
        new_values TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
      
      PRAGMA user_version = 1;
    `);
  });
  
  transaction();
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function resetDatabase(): void {
  const db = getDatabase();
  const transaction = db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS projection_checks;
      DROP TABLE IF EXISTS schedules;
      DROP TABLE IF EXISTS kdms;
      DROP TABLE IF EXISTS auditorium_devices;
      DROP TABLE IF EXISTS film_versions;
      PRAGMA user_version = 0;
    `);
  });
  transaction();
  closeDatabase();
}
