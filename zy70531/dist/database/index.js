"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const DB_PATH = path_1.default.join(__dirname, '../../data/ticket-scan.db');
let db;
function initDatabase() {
    return new Promise((resolve, reject) => {
        const dbDir = path_1.default.dirname(DB_PATH);
        require('fs').mkdirSync(dbDir, { recursive: true });
        db = new sqlite3_1.default.Database(DB_PATH, (err) => {
            if (err) {
                reject(err);
                return;
            }
            console.log('SQLite database connected');
        });
        db.serialize(() => {
            db.run(`
        CREATE TABLE IF NOT EXISTS ticket_scan_records (
          id TEXT PRIMARY KEY,
          ticket_id TEXT NOT NULL,
          attachments TEXT NOT NULL,
          scan_engine TEXT NOT NULL,
          risk_level TEXT NOT NULL DEFAULT 'safe',
          isolation_action TEXT NOT NULL DEFAULT 'none',
          status TEXT NOT NULL,
          processing_summary TEXT,
          scan_report TEXT,
          virus_found TEXT,
          failure_records TEXT,
          reviewed_by TEXT,
          review_comment TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          scanned_at TEXT,
          reviewed_at TEXT
        )
      `);
            db.run(`CREATE INDEX IF NOT EXISTS idx_ticket_id ON ticket_scan_records(ticket_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_status ON ticket_scan_records(status)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_created_at ON ticket_scan_records(created_at)`);
            resolve();
        });
    });
}
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}
function closeDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        }
        else {
            resolve();
        }
    });
}
