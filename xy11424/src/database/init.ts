import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || './data/preparation_traceability.db';

export function initDatabase(): sqlite3.Database {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new sqlite3.Database(DB_PATH);

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS inspection_orders (
      id TEXT PRIMARY KEY,
      requestId TEXT NOT NULL,
      vin TEXT NOT NULL,
      plateNumber TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      mileage INTEGER NOT NULL,
      inspectionDate INTEGER NOT NULL,
      inspectorName TEXT NOT NULL,
      items TEXT NOT NULL,
      totalCost REAL NOT NULL,
      status TEXT NOT NULL,
      remarks TEXT,
      createdBy TEXT NOT NULL,
      updatedBy TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(requestId)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS repair_quotes (
      id TEXT PRIMARY KEY,
      requestId TEXT NOT NULL,
      vin TEXT NOT NULL,
      plateNumber TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      mileage INTEGER NOT NULL,
      quoteDate INTEGER NOT NULL,
      repairShop TEXT NOT NULL,
      quoteManager TEXT NOT NULL,
      items TEXT NOT NULL,
      laborCost REAL NOT NULL,
      partsCost REAL NOT NULL,
      totalCost REAL NOT NULL,
      estimatedDuration INTEGER NOT NULL,
      status TEXT NOT NULL,
      remarks TEXT,
      createdBy TEXT NOT NULL,
      updatedBy TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(requestId)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS photo_inventories (
      id TEXT PRIMARY KEY,
      requestId TEXT NOT NULL,
      vin TEXT NOT NULL,
      plateNumber TEXT NOT NULL,
      photoDate INTEGER NOT NULL,
      uploader TEXT NOT NULL,
      photos TEXT NOT NULL,
      status TEXT NOT NULL,
      remarks TEXT,
      createdBy TEXT NOT NULL,
      updatedBy TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(requestId)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      requestId TEXT NOT NULL,
      source TEXT NOT NULL,
      action TEXT NOT NULL,
      oldStatus TEXT,
      newStatus TEXT,
      operatorId TEXT NOT NULL,
      operatorName TEXT NOT NULL,
      operatorRole TEXT NOT NULL,
      changeReason TEXT,
      fieldChanges TEXT,
      timestamp INTEGER NOT NULL,
      ipAddress TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS failed_records (
      id TEXT PRIMARY KEY,
      requestId TEXT NOT NULL,
      source TEXT NOT NULL,
      rawData TEXT NOT NULL,
      errorType TEXT NOT NULL,
      errorMessage TEXT NOT NULL,
      validationErrors TEXT NOT NULL,
      receivedAt INTEGER NOT NULL,
      operatorId TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolvedAt INTEGER,
      resolutionNote TEXT
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_requestId ON inspection_orders(requestId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_vin ON inspection_orders(vin)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_status ON inspection_orders(status)`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_repair_requestId ON repair_quotes(requestId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_repair_vin ON repair_quotes(vin)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_repair_status ON repair_quotes(status)`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_photo_requestId ON photo_inventories(requestId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_photo_vin ON photo_inventories(vin)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_photo_status ON photo_inventories(status)`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_requestId ON audit_logs(requestId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_failed_resolved ON failed_records(resolved)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_failed_requestId ON failed_records(requestId)`);
  });

  return db;
}

export default initDatabase;
