"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDb = exports.getDb = exports.initDatabase = exports.ensureDataDir = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dbPath = path_1.default.join(__dirname, '../data/freeze-validation.db');
let db = null;
const ensureDataDir = () => {
    const dataDir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
};
exports.ensureDataDir = ensureDataDir;
const initDatabase = () => {
    (0, exports.ensureDataDir)();
    if (!db) {
        db = new sqlite3_1.default.Database(dbPath);
    }
    db.serialize(() => {
        db.run(`
      CREATE TABLE IF NOT EXISTS lab_samples (
        id TEXT PRIMARY KEY,
        business_no TEXT UNIQUE NOT NULL,
        sample_no TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        sample_type TEXT NOT NULL,
        collect_time DATETIME NOT NULL,
        receive_time DATETIME NOT NULL,
        test_items TEXT NOT NULL,
        department TEXT NOT NULL,
        doctor TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        raw_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        db.run(`
      CREATE TABLE IF NOT EXISTS validation_records (
        id TEXT PRIMARY KEY,
        business_no TEXT NOT NULL,
        sample_id TEXT NOT NULL,
        validation_type TEXT NOT NULL,
        window_start DATETIME NOT NULL,
        window_end DATETIME NOT NULL,
        status TEXT NOT NULL,
        result TEXT,
        operator TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sample_id) REFERENCES lab_samples(id)
      )
    `);
        db.run(`
      CREATE TABLE IF NOT EXISTS failure_records (
        id TEXT PRIMARY KEY,
        business_no TEXT NOT NULL,
        sample_id TEXT NOT NULL,
        validation_id TEXT,
        failure_type TEXT NOT NULL,
        error_code TEXT NOT NULL,
        error_message TEXT NOT NULL,
        gateway_error TEXT,
        correction_suggestion TEXT,
        conclusion TEXT,
        raw_payload TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sample_id) REFERENCES lab_samples(id),
        FOREIGN KEY (validation_id) REFERENCES validation_records(id)
      )
    `);
        db.run(`
      CREATE TABLE IF NOT EXISTS anomaly_samples (
        id TEXT PRIMARY KEY,
        business_no TEXT NOT NULL,
        sample_id TEXT NOT NULL,
        anomaly_type TEXT NOT NULL,
        description TEXT NOT NULL,
        original_record_id TEXT NOT NULL,
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sample_id) REFERENCES lab_samples(id)
      )
    `);
        db.run(`
      CREATE TABLE IF NOT EXISTS batch_operations (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        status TEXT DEFAULT 'preview',
        affected_count INTEGER DEFAULT 0,
        preview_data TEXT,
        operator TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        executed_at DATETIME
      )
    `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_lab_samples_business_no ON lab_samples(business_no)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_validation_records_business_no ON validation_records(business_no)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_failure_records_business_no ON failure_records(business_no)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_anomaly_samples_business_no ON anomaly_samples(business_no)`);
    });
    return db;
};
exports.initDatabase = initDatabase;
const getDb = () => {
    if (!db) {
        return (0, exports.initDatabase)();
    }
    return db;
};
exports.getDb = getDb;
const closeDb = () => {
    if (db) {
        db.close();
        db = null;
    }
};
exports.closeDb = closeDb;
exports.default = {
    getDb: exports.getDb,
    initDatabase: exports.initDatabase,
    ensureDataDir: exports.ensureDataDir,
    closeDb: exports.closeDb
};
