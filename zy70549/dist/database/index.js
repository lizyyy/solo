"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.initializeSchema = initializeSchema;
exports.getDb = getDb;
exports.runQuery = runQuery;
exports.getOne = getOne;
exports.getAll = getAll;
exports.closeDatabase = closeDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DB_PATH = process.env.DB_PATH || path_1.default.join(__dirname, "../../data/audit-proof.db");
let dbInstance = null;
async function initDatabase() {
    const dbDir = path_1.default.dirname(DB_PATH);
    if (!fs_1.default.existsSync(dbDir)) {
        fs_1.default.mkdirSync(dbDir, { recursive: true });
    }
    return new Promise((resolve, reject) => {
        const db = new sqlite3_1.default.Database(DB_PATH, (err) => {
            if (err) {
                reject(err);
                return;
            }
            console.log("Connected to SQLite database at:", DB_PATH);
            dbInstance = db;
            resolve(db);
        });
    });
}
async function initializeSchema(db) {
    const tables = [
        `CREATE TABLE IF NOT EXISTS log_topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
        `CREATE TABLE IF NOT EXISTS event_ranges (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      start_event_id TEXT,
      end_event_id TEXT,
      event_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
        `CREATE TABLE IF NOT EXISTS hash_chains (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      event_id TEXT NOT NULL UNIQUE,
      event_timestamp TEXT NOT NULL,
      previous_hash TEXT NOT NULL,
      current_hash TEXT NOT NULL,
      event_content_hash TEXT NOT NULL,
      chain_sequence INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
        `CREATE INDEX IF NOT EXISTS idx_hash_chains_topic_sequence ON hash_chains(topic_id, chain_sequence)`,
        `CREATE TABLE IF NOT EXISTS export_requests (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      range_id TEXT NOT NULL,
      requester TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approver TEXT,
      approval_comment TEXT,
      approved_at TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      original_input TEXT NOT NULL,
      processing_evidence TEXT,
      failure_reason TEXT,
      final_conclusion TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
        `CREATE INDEX IF NOT EXISTS idx_export_requests_idempotency ON export_requests(idempotency_key)`,
        `CREATE INDEX IF NOT EXISTS idx_export_requests_status ON export_requests(status)`,
        `CREATE TABLE IF NOT EXISTS verification_results (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      range_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      hash_chain_valid INTEGER NOT NULL DEFAULT 0,
      first_hash TEXT NOT NULL,
      last_hash TEXT NOT NULL,
      verified_count INTEGER NOT NULL DEFAULT 0,
      total_count INTEGER NOT NULL DEFAULT 0,
      mismatch_details TEXT,
      verified_at TEXT NOT NULL DEFAULT (datetime('now')),
      verified_by TEXT NOT NULL
    )`,
        `CREATE TABLE IF NOT EXISTS proof_reports (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      verification_id TEXT NOT NULL,
      report_content TEXT NOT NULL,
      file_path TEXT,
      file_format TEXT NOT NULL DEFAULT 'json',
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
        `CREATE TABLE IF NOT EXISTS audit_log_events (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
        `CREATE INDEX IF NOT EXISTS idx_audit_events_topic_time ON audit_log_events(topic_id, timestamp)`,
        `CREATE TABLE IF NOT EXISTS processing_history (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
        `CREATE INDEX IF NOT EXISTS idx_processing_history_request ON processing_history(request_id)`
    ];
    for (const sql of tables) {
        await new Promise((resolve, reject) => {
            db.run(sql, (err) => {
                if (err) {
                    console.error("SQL Error:", sql.substring(0, 50), "...");
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    console.log("Database schema initialized successfully");
}
function getDb() {
    if (!dbInstance) {
        throw new Error("Database not initialized. Call initDatabase first.");
    }
    return dbInstance;
}
async function runQuery(sql, params = []) {
    const db = getDb();
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}
async function getOne(sql, params = []) {
    const db = getDb();
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(row || null);
            }
        });
    });
}
async function getAll(sql, params = []) {
    const db = getDb();
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows || []);
            }
        });
    });
}
async function closeDatabase() {
    if (dbInstance) {
        return new Promise((resolve) => {
            dbInstance.close(() => { resolve(); });
        });
    }
}
