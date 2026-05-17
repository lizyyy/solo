"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.runQuery = runQuery;
exports.getQuery = getQuery;
exports.allQuery = allQuery;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.join(__dirname, '..', 'device_rebind.db');
exports.db = new sqlite3_1.default.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    }
    else {
        console.log('数据库连接成功');
        initTables();
    }
});
function initTables() {
    exports.db.serialize(() => {
        exports.db.run(`
      CREATE TABLE IF NOT EXISTS device_rebind (
        id TEXT PRIMARY KEY,
        device_code TEXT NOT NULL,
        old_store_id TEXT NOT NULL,
        old_store_name TEXT,
        new_store_id TEXT NOT NULL,
        new_store_name TEXT,
        repair_order_id TEXT,
        rebind_reason TEXT NOT NULL,
        rebind_report TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        warranty_valid BOOLEAN DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_by TEXT,
        approved_at DATETIME,
        original_input TEXT,
        processing_evidence TEXT,
        exception_reason TEXT
      )
    `);
        exports.db.run(`
      CREATE TABLE IF NOT EXISTS rebind_history (
        id TEXT PRIMARY KEY,
        rebind_id TEXT NOT NULL,
        device_code TEXT NOT NULL,
        old_store_id TEXT NOT NULL,
        new_store_id TEXT NOT NULL,
        status TEXT NOT NULL,
        operated_by TEXT,
        operated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        remark TEXT,
        FOREIGN KEY (rebind_id) REFERENCES device_rebind(id)
      )
    `);
        exports.db.run(`CREATE INDEX IF NOT EXISTS idx_device_code ON device_rebind(device_code)`);
        exports.db.run(`CREATE INDEX IF NOT EXISTS idx_status ON device_rebind(status)`);
        exports.db.run(`CREATE INDEX IF NOT EXISTS idx_created_at ON device_rebind(created_at)`);
    });
}
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        exports.db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        exports.db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
}
function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        exports.db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
}
