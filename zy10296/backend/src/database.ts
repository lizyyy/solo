import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'data', 'charity.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      familyId TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      members INTEGER NOT NULL DEFAULT 1,
      address TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer TEXT,
      reviewTime TEXT,
      remarks TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      description TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      materialId INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      cycleDays INTEGER NOT NULL DEFAULT 30,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (materialId) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      distributionNo TEXT UNIQUE NOT NULL,
      familyId INTEGER NOT NULL,
      batchId INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      distributor TEXT,
      distributeTime TEXT,
      isProxy INTEGER NOT NULL DEFAULT 0,
      proxyName TEXT,
      proxyIdCard TEXT,
      proxyProof INTEGER DEFAULT 0,
      blockReason TEXT,
      needReview INTEGER NOT NULL DEFAULT 0,
      reviewStatus TEXT NOT NULL DEFAULT 'pending',
      reviewer TEXT,
      reviewTime TEXT,
      remarks TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (familyId) REFERENCES families(id),
      FOREIGN KEY (batchId) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS return_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      distributionId INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT NOT NULL,
      returnTime TEXT NOT NULL,
      operator TEXT NOT NULL,
      inventoryRestored INTEGER NOT NULL DEFAULT 0,
      restoreTime TEXT,
      remarks TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (distributionId) REFERENCES distributions(id)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materialId INTEGER NOT NULL,
      batchId INTEGER NOT NULL,
      totalQuantity INTEGER NOT NULL,
      distributedQuantity INTEGER NOT NULL DEFAULT 0,
      returnedQuantity INTEGER NOT NULL DEFAULT 0,
      availableQuantity INTEGER NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(materialId, batchId),
      FOREIGN KEY (materialId) REFERENCES materials(id),
      FOREIGN KEY (batchId) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS distribution_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      distributionId INTEGER NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      details TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (distributionId) REFERENCES distributions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_distributions_family ON distributions(familyId);
    CREATE INDEX IF NOT EXISTS idx_distributions_batch ON distributions(batchId);
    CREATE INDEX IF NOT EXISTS idx_distributions_status ON distributions(status);
  `);

  return db;
}

export default db;
