"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getDatabase = getDatabase;
exports.runSql = runSql;
exports.querySql = querySql;
exports.queryOne = queryOne;
const sqlite3_1 = __importDefault(require("sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dbPath = './data/object_storage.db';
let db;
function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
}
async function initDatabase() {
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    return new Promise((resolve, reject) => {
        db = new sqlite3_1.default.Database(dbPath, async (err) => {
            if (err) {
                reject(err);
                return;
            }
            try {
                await runAsync(`CREATE TABLE IF NOT EXISTS objects (
          object_id TEXT PRIMARY KEY,
          bucket_name TEXT NOT NULL,
          object_key TEXT NOT NULL,
          size INTEGER NOT NULL,
          storage_class TEXT NOT NULL,
          last_modified TEXT NOT NULL,
          created_time TEXT NOT NULL,
          e_tag TEXT NOT NULL,
          version_id TEXT NOT NULL,
          delete_protection INTEGER NOT NULL DEFAULT 0,
          tags TEXT,
          current_thaw_job_id TEXT,
          UNIQUE(bucket_name, object_key, version_id)
        )`);
                await runAsync(`CREATE TABLE IF NOT EXISTS lifecycle_rules (
          rule_id TEXT PRIMARY KEY,
          bucket_name TEXT NOT NULL,
          rule_name TEXT NOT NULL,
          status TEXT NOT NULL,
          prefix TEXT,
          tags TEXT,
          actions TEXT NOT NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          created_time TEXT NOT NULL,
          last_modified TEXT NOT NULL
        )`);
                await runAsync(`CREATE TABLE IF NOT EXISTS thaw_jobs (
          thaw_job_id TEXT PRIMARY KEY,
          object_id TEXT NOT NULL,
          object_key TEXT NOT NULL,
          bucket_name TEXT NOT NULL,
          requested_by TEXT NOT NULL,
          requested_at TEXT NOT NULL,
          status TEXT NOT NULL,
          thaw_days INTEGER NOT NULL,
          retrieval_tier TEXT NOT NULL,
          progress INTEGER NOT NULL DEFAULT 0,
          started_at TEXT,
          completed_at TEXT,
          expires_at TEXT,
          failure_reason TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 3,
          FOREIGN KEY (object_id) REFERENCES objects(object_id)
        )`);
                await runAsync(`CREATE TABLE IF NOT EXISTS operation_logs (
          log_id TEXT PRIMARY KEY,
          operation TEXT NOT NULL,
          object_id TEXT,
          bucket_name TEXT,
          object_key TEXT,
          request_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          status TEXT NOT NULL,
          details TEXT NOT NULL,
          cost_estimate REAL
        )`);
                await runAsync(`CREATE TABLE IF NOT EXISTS failed_tasks (
          task_id TEXT PRIMARY KEY,
          task_type TEXT NOT NULL,
          object_id TEXT NOT NULL,
          failure_reason TEXT NOT NULL,
          failed_at TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 5,
          next_retry_at TEXT,
          task_data TEXT NOT NULL
        )`);
                await runAsync(`CREATE INDEX IF NOT EXISTS idx_objects_bucket ON objects(bucket_name, object_key)`);
                await runAsync(`CREATE INDEX IF NOT EXISTS idx_thaw_jobs_object ON thaw_jobs(object_id)`);
                await runAsync(`CREATE INDEX IF NOT EXISTS idx_thaw_jobs_status ON thaw_jobs(status)`);
                await runAsync(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON operation_logs(timestamp)`);
                await runAsync(`CREATE INDEX IF NOT EXISTS idx_failed_tasks_retry ON failed_tasks(next_retry_at)`);
                resolve();
            }
            catch (tableErr) {
                reject(tableErr);
            }
        });
    });
}
function getDatabase() {
    return db;
}
function runSql(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve(this.lastID);
        });
    });
}
function querySql(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
}
function queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
}
