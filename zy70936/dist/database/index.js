"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getDb = getDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
let db;
function initDatabase(dbPath) {
    const databasePath = dbPath || path.join(process.cwd(), 'pharmacy.db');
    db = new better_sqlite3_1.default(databasePath);
    db.pragma('journal_mode = WAL');
    createTables();
    return db;
}
function getDb() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}
function createTables() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      id_card TEXT NOT NULL,
      phone TEXT NOT NULL,
      tags TEXT,
      address TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      is_controlled INTEGER NOT NULL DEFAULT 0,
      contraindications TEXT,
      min_interval_days INTEGER NOT NULL DEFAULT 0,
      max_dosage INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchase_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      purchase_date INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      processed_by TEXT,
      processed_at INTEGER,
      follow_up_date INTEGER,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS follow_up_rules (
      id TEXT PRIMARY KEY,
      medicine_category TEXT NOT NULL,
      days_after_purchase INTEGER NOT NULL,
      required_checks TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      source_file TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS privacy_audit_logs (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      original_value TEXT NOT NULL,
      masked_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_privacy_customer ON privacy_audit_logs(customer_id);

    CREATE INDEX IF NOT EXISTS idx_purchase_customer ON purchase_records(customer_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_medicine ON purchase_records(medicine_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_status ON purchase_records(status);
    CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(record_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_date ON purchase_records(purchase_date);
  `);
}
