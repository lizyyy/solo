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
exports.executeAll = exports.executeGet = exports.convertRowsToObjects = exports.convertRowToObject = exports.now = exports.generateId = exports.getDb = exports.saveDatabase = exports.initDb = void 0;
const sql_js_1 = __importDefault(require("sql.js"));
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DB_FILE = path.resolve(__dirname, '..', 'delivery_service.db');
let db = null;
let SQL = null;
const initDb = async () => {
    SQL = await (0, sql_js_1.default)();
    let dbData = null;
    if (fs.existsSync(DB_FILE)) {
        dbData = fs.readFileSync(DB_FILE);
    }
    db = new SQL.Database(dbData);
    db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      merchant_id TEXT NOT NULL,
      merchant_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      rider_id TEXT,
      rider_name TEXT,
      order_amount REAL NOT NULL,
      status TEXT NOT NULL,
      expected_meal_minutes INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS order_nodes (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      node_status TEXT NOT NULL,
      operator_id TEXT,
      operator_role TEXT,
      remark TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS meal_timers (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      expected_meal_minutes INTEGER NOT NULL,
      actual_meal_minutes REAL,
      is_overtime INTEGER NOT NULL DEFAULT 0,
      overtime_minutes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS liability_judgments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      meal_timer_id TEXT NOT NULL,
      liable_party TEXT NOT NULL,
      judgment_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (meal_timer_id) REFERENCES meal_timers(id)
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS compensations (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      liability_judgment_id TEXT NOT NULL,
      compensation_type TEXT NOT NULL,
      target_party TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      remark TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (liability_judgment_id) REFERENCES liability_judgments(id)
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS appeals (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      compensation_id TEXT NOT NULL,
      appellant_party TEXT NOT NULL,
      appellant_id TEXT NOT NULL,
      appeal_reason TEXT NOT NULL,
      appeal_evidence TEXT,
      status TEXT NOT NULL,
      reviewer_id TEXT,
      review_result TEXT,
      created_at INTEGER NOT NULL,
      reviewed_at INTEGER,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (compensation_id) REFERENCES compensations(id)
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS idempotent_requests (
      id TEXT PRIMARY KEY,
      request_key TEXT UNIQUE NOT NULL,
      request_type TEXT NOT NULL,
      response_data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      operation_detail TEXT,
      old_data TEXT,
      new_data TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_order_nodes_order_id ON order_nodes(order_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_meal_timers_order_id ON meal_timers(order_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_liability_judgments_order_id ON liability_judgments(order_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_compensations_order_id ON compensations(order_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_appeals_order_id ON appeals(order_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_operation_logs_order_id ON operation_logs(order_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_idempotent_requests_key ON idempotent_requests(request_key)`);
};
exports.initDb = initDb;
const saveDatabase = () => {
    if (!db)
        return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
};
exports.saveDatabase = saveDatabase;
const getDb = () => {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
};
exports.getDb = getDb;
const generateId = () => {
    return (0, uuid_1.v4)();
};
exports.generateId = generateId;
const now = () => {
    return Date.now();
};
exports.now = now;
const convertRowToObject = (columnNames, row) => {
    const obj = {};
    columnNames.forEach((name, index) => {
        obj[name] = row[index];
    });
    return obj;
};
exports.convertRowToObject = convertRowToObject;
const convertRowsToObjects = (columnNames, rows) => {
    return rows.map(row => (0, exports.convertRowToObject)(columnNames, row));
};
exports.convertRowsToObjects = convertRowsToObjects;
const executeGet = (query, params = []) => {
    const stmt = (0, exports.getDb)().prepare(query);
    stmt.bind(params);
    if (stmt.step()) {
        const row = stmt.get();
        const columnNames = stmt.getColumnNames();
        stmt.free();
        return (0, exports.convertRowToObject)(columnNames, row);
    }
    stmt.free();
    return null;
};
exports.executeGet = executeGet;
const executeAll = (query, params = []) => {
    const stmt = (0, exports.getDb)().prepare(query);
    stmt.bind(params);
    const columnNames = stmt.getColumnNames();
    const results = [];
    while (stmt.step()) {
        const row = stmt.get();
        results.push((0, exports.convertRowToObject)(columnNames, row));
    }
    stmt.free();
    return results;
};
exports.executeAll = executeAll;
//# sourceMappingURL=database.js.map