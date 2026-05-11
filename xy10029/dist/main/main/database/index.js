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
exports.initSqlJsModule = initSqlJsModule;
exports.getDbFilePath = getDbFilePath;
exports.saveDatabaseToDisk = saveDatabaseToDisk;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
exports.initDatabase = initDatabase;
exports.exec = exec;
exports.run = run;
exports.get = get;
exports.all = all;
exports.beginTransaction = beginTransaction;
exports.commitTransaction = commitTransaction;
exports.rollbackTransaction = rollbackTransaction;
exports.flushDatabase = flushDatabase;
const sql_js_1 = __importDefault(require("sql.js"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const crypto_1 = require("crypto");
const types_1 = require("@shared/types");
const utils_1 = require("@shared/utils");
let sqlJs;
let database;
let dbFilePath;
function hashPassword(password) {
    return (0, crypto_1.createHash)('sha256').update(password).digest('hex');
}
function getWasmPath() {
    const possiblePaths = [];
    try {
        possiblePaths.push(path_1.default.join(__dirname, 'sql-wasm.wasm'));
    }
    catch (e) {
    }
    try {
        const nodeModulesPath = require.resolve('sql.js');
        possiblePaths.push(path_1.default.join(path_1.default.dirname(nodeModulesPath), 'dist', 'sql-wasm.wasm'));
    }
    catch (e) {
    }
    try {
        if (electron_1.app) {
            possiblePaths.push(path_1.default.join(electron_1.app.getAppPath(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'));
        }
    }
    catch (e) {
    }
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return 'sql-wasm.wasm';
}
async function initSqlJsModule() {
    if (!sqlJs) {
        const wasmPath = getWasmPath();
        sqlJs = await (0, sql_js_1.default)({
            locateFile: () => wasmPath
        });
    }
    return sqlJs;
}
function getDbFilePath() {
    if (dbFilePath) {
        return dbFilePath;
    }
    try {
        dbFilePath = path_1.default.join(electron_1.app.getPath('userData'), 'device-management.db');
    }
    catch {
        dbFilePath = path_1.default.join(process.cwd(), 'device-management.db');
    }
    return dbFilePath;
}
function saveDatabaseToDisk() {
    if (database) {
        const data = database.export();
        const buffer = Buffer.from(data);
        try {
            const filePath = getDbFilePath();
            const dir = path_1.default.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, buffer);
        }
        catch (e) {
        }
    }
}
async function getDatabase() {
    if (!database) {
        const SQL = await initSqlJsModule();
        let existingDbPath = getDbFilePath();
        if (fs.existsSync(existingDbPath)) {
            try {
                const fileBuffer = fs.readFileSync(existingDbPath);
                database = new SQL.Database(fileBuffer);
            }
            catch {
                database = new SQL.Database();
            }
        }
        else {
            database = new SQL.Database();
        }
    }
    return database;
}
function closeDatabase() {
    if (database) {
        saveDatabaseToDisk();
        database.close();
        database = null;
    }
}
async function initDatabase() {
    const db = await getDatabase();
    const initSql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      device_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      model TEXT,
      serial_number TEXT,
      status TEXT NOT NULL,
      location TEXT,
      description TEXT,
      current_holder TEXT,
      current_holder_name TEXT,
      borrowed_at TEXT,
      expected_return_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS borrow_records (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      device_code TEXT NOT NULL,
      borrower_id TEXT NOT NULL,
      borrower_name TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      borrowed_at TEXT NOT NULL,
      expected_return_at TEXT,
      returned_at TEXT,
      status TEXT NOT NULL,
      purpose TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_history (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_by_name TEXT NOT NULL,
      change_type TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      details TEXT NOT NULL,
      success INTEGER NOT NULL,
      error_message TEXT,
      duration INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS failed_operations (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      details TEXT NOT NULL,
      error_message TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL,
      last_attempt_at TEXT NOT NULL,
      next_retry_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batch_operations (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      total_count INTEGER NOT NULL,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      results TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_by_name TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
    CREATE INDEX IF NOT EXISTS idx_devices_code ON devices(device_code);
    CREATE INDEX IF NOT EXISTS idx_borrow_records_device ON borrow_records(device_id);
    CREATE INDEX IF NOT EXISTS idx_borrow_records_status ON borrow_records(status);
    CREATE INDEX IF NOT EXISTS idx_history_device ON device_history(device_id);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_failed_status ON failed_operations(status);
  `;
    db.run(initSql);
    saveDatabaseToDisk();
    const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM users');
    let userCount = 0;
    if (userCountStmt.step()) {
        const row = userCountStmt.getAsObject();
        userCount = row.count || 0;
    }
    userCountStmt.free();
    if (userCount === 0) {
        const now = (0, utils_1.getCurrentTimestamp)();
        const adminId = (0, utils_1.generateId)();
        db.run(`
      INSERT INTO users (id, username, password, display_name, role, created_at, updated_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            adminId,
            'admin',
            hashPassword('admin123'),
            '系统管理员',
            types_1.UserRole.ADMIN,
            now,
            now,
            1
        ]);
        db.run(`
      INSERT INTO users (id, username, password, display_name, role, created_at, updated_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            (0, utils_1.generateId)(),
            'operator',
            hashPassword('operator123'),
            '设备操作员',
            types_1.UserRole.OPERATOR,
            now,
            now,
            1
        ]);
        db.run(`
      INSERT INTO users (id, username, password, display_name, role, created_at, updated_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            (0, utils_1.generateId)(),
            'zhangsan',
            hashPassword('123456'),
            '张三',
            types_1.UserRole.USER,
            now,
            now,
            1
        ]);
        saveDatabaseToDisk();
    }
}
async function exec(sql, params = []) {
    const db = await getDatabase();
    db.run(sql, params);
    saveDatabaseToDisk();
}
async function run(sql, params = []) {
    const db = await getDatabase();
    db.run(sql, params);
    saveDatabaseToDisk();
    return {
        changes: db.getRowsModified(),
        lastInsertRowid: 0
    };
}
async function get(sql, params = []) {
    const db = await getDatabase();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
    }
    else {
        stmt.free();
        return null;
    }
}
async function all(sql, params = []) {
    const db = await getDatabase();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}
async function beginTransaction() {
    await exec('BEGIN TRANSACTION');
}
async function commitTransaction() {
    await exec('COMMIT');
}
async function rollbackTransaction() {
    await exec('ROLLBACK');
}
function flushDatabase() {
    saveDatabaseToDisk();
}
//# sourceMappingURL=index.js.map