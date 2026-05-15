import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'tenant-export.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      metadata TEXT NOT NULL DEFAULT '{}',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS data_scopes (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      name TEXT NOT NULL,
      scopeType TEXT NOT NULL,
      dateRange TEXT,
      dataTypes TEXT NOT NULL,
      filters TEXT,
      snapshotVersion TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS export_tasks (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      scopeId TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      errorMessage TEXT,
      errorStack TEXT,
      retryCount INTEGER NOT NULL DEFAULT 0,
      maxRetries INTEGER NOT NULL DEFAULT 3,
      createdBy TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      startedAt INTEGER,
      completedAt INTEGER,
      expiredAt INTEGER NOT NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id),
      FOREIGN KEY (scopeId) REFERENCES data_scopes(id)
    );

    CREATE TABLE IF NOT EXISTS file_manifests (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      fileName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      fileType TEXT NOT NULL,
      checksum TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (taskId) REFERENCES export_tasks(id)
    );

    CREATE TABLE IF NOT EXISTS verification_summaries (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      totalFiles INTEGER NOT NULL,
      totalSize INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      algorithm TEXT NOT NULL,
      metadata TEXT NOT NULL,
      verifiedAt INTEGER NOT NULL,
      isValid INTEGER NOT NULL,
      FOREIGN KEY (taskId) REFERENCES export_tasks(id)
    );

    CREATE TABLE IF NOT EXISTS download_records (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      downloadToken TEXT NOT NULL,
      downloadedBy TEXT NOT NULL,
      downloadedAt INTEGER NOT NULL,
      clientIp TEXT NOT NULL,
      userAgent TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      FOREIGN KEY (taskId) REFERENCES export_tasks(id)
    );

    CREATE TABLE IF NOT EXISTS export_certificates (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      certificateNumber TEXT NOT NULL,
      issuedAt INTEGER NOT NULL,
      issuer TEXT NOT NULL,
      metadata TEXT NOT NULL,
      signature TEXT NOT NULL,
      FOREIGN KEY (taskId) REFERENCES export_tasks(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON export_tasks(tenantId);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON export_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_created ON export_tasks(createdAt);
    CREATE INDEX IF NOT EXISTS idx_files_task ON file_manifests(taskId);
  `);

  const tenantCount = db.prepare('SELECT COUNT(*) as count FROM tenants').get() as { count: number };
  if (tenantCount.count === 0) {
    const now = Date.now();
    const insertTenant = db.prepare(`
      INSERT INTO tenants (id, name, code, status, metadata, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertTenant.run(
      uuidv4(),
      '演示大客户',
      'DEMO_001',
      'active',
      JSON.stringify({ level: 'VIP', contact: 'contact@demo.com' }),
      now,
      now
    );
    insertTenant.run(
      uuidv4(),
      '测试租户',
      'TEST_001',
      'active',
      JSON.stringify({ level: 'Standard' }),
      now,
      now
    );
  }
}

export default db;
