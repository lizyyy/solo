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
exports.getDb = getDb;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
let db = null;
async function getDb() {
    if (!db) {
        const dbDir = path.resolve(__dirname, '..');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        const dbPath = path.join(dbDir, 'quota.db');
        db = await (0, sqlite_1.open)({
            filename: dbPath,
            driver: sqlite3_1.default.Database
        });
        await initTables(db);
    }
    return db;
}
async function initTables(db) {
    await db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      member_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS quota_packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      total_quota INTEGER NOT NULL,
      remaining_quota INTEGER NOT NULL,
      member_id TEXT NOT NULL,
      project_id TEXT,
      valid_from INTEGER NOT NULL,
      valid_to INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS generation_requests (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE NOT NULL,
      member_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      quota_package_id TEXT NOT NULL,
      quota_consumed INTEGER NOT NULL,
      prompt TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (quota_package_id) REFERENCES quota_packages(id)
    );

    CREATE TABLE IF NOT EXISTS failure_credits (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      quota_package_id TEXT NOT NULL,
      quota_returned INTEGER NOT NULL,
      reason TEXT,
      reviewed_by TEXT,
      review_note TEXT,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      reviewed_at INTEGER,
      FOREIGN KEY (request_id) REFERENCES generation_requests(id),
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (quota_package_id) REFERENCES quota_packages(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_summaries (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      project_id TEXT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      total_requests INTEGER NOT NULL DEFAULT 0,
      successful_requests INTEGER NOT NULL DEFAULT 0,
      failed_requests INTEGER NOT NULL DEFAULT 0,
      quota_consumed INTEGER NOT NULL DEFAULT 0,
      quota_returned INTEGER NOT NULL DEFAULT 0,
      net_quota_used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(member_id, project_id, year, month),
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_requests_idempotency ON generation_requests(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_requests_member ON generation_requests(member_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON generation_requests(status);
    CREATE INDEX IF NOT EXISTS idx_credits_status ON failure_credits(status);
  `);
}
