"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const DB_PATH = path_1.default.join(__dirname, '..', 'court-documents.db');
async function initDatabase() {
    const db = await (0, sqlite_1.open)({
        filename: DB_PATH,
        driver: sqlite3_1.default.Database
    });
    await db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batch_number TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      description TEXT,
      total_materials INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      document_number TEXT NOT NULL,
      case_number TEXT,
      document_type TEXT,
      borrower TEXT,
      borrow_date DATE,
      return_date DATE,
      original_data TEXT,
      status TEXT DEFAULT 'pending',
      status_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS processing_trails (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      status_reason TEXT,
      processed_by TEXT NOT NULL,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      note TEXT,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      modified_by TEXT NOT NULL,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      change_reason TEXT NOT NULL,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE INDEX IF NOT EXISTS idx_materials_batch_id ON materials(batch_id);
    CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
    CREATE INDEX IF NOT EXISTS idx_processing_trails_material_id ON processing_trails(material_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_material_id ON audit_logs(material_id);
  `);
    return db;
}
