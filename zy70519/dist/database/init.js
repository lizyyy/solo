"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = exports.initDatabase = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const getDataDir = () => path_1.default.join(process.cwd(), 'data');
const getDbPath = () => path_1.default.join(getDataDir(), 'cache_warmup.db');
const ensureDataDir = () => {
    const dataDir = getDataDir();
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
};
const initDatabase = () => {
    return new Promise((resolve, reject) => {
        ensureDataDir();
        const db = new sqlite3_1.default.Database(getDbPath(), (err) => {
            if (err) {
                reject(err);
                return;
            }
            console.log('Connected to SQLite database');
        });
        db.serialize(() => {
            db.run(`
        CREATE TABLE IF NOT EXISTS data_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          config TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS execution_nodes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          ip TEXT NOT NULL,
          status TEXT NOT NULL,
          current_batch_id TEXT,
          last_heartbeat TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS warmup_batches (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL,
          total_keys INTEGER NOT NULL,
          success_keys INTEGER NOT NULL,
          failed_keys INTEGER NOT NULL,
          pending_keys INTEGER NOT NULL,
          data_source_id TEXT NOT NULL,
          assigned_node_id TEXT,
          priority INTEGER NOT NULL,
          scheduled_at TEXT,
          started_at TEXT,
          completed_at TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (data_source_id) REFERENCES data_sources(id),
          FOREIGN KEY (assigned_node_id) REFERENCES execution_nodes(id)
        )
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS cache_keys (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          cache_key TEXT NOT NULL,
          cache_type TEXT NOT NULL,
          ttl INTEGER,
          status TEXT NOT NULL,
          data_source_id TEXT NOT NULL,
          data_query TEXT NOT NULL,
          assigned_node_id TEXT,
          retry_count INTEGER NOT NULL,
          max_retries INTEGER NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (batch_id) REFERENCES warmup_batches(id),
          FOREIGN KEY (data_source_id) REFERENCES data_sources(id),
          FOREIGN KEY (assigned_node_id) REFERENCES execution_nodes(id)
        )
      `);
            db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_keys_batch_key 
        ON cache_keys(batch_id, cache_key)
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS failure_records (
          id TEXT PRIMARY KEY,
          cache_key_id TEXT NOT NULL,
          batch_id TEXT NOT NULL,
          original_input TEXT NOT NULL,
          processing_basis TEXT NOT NULL,
          error_message TEXT NOT NULL,
          error_stack TEXT,
          final_conclusion TEXT NOT NULL,
          node_id TEXT,
          occurred_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (cache_key_id) REFERENCES cache_keys(id),
          FOREIGN KEY (batch_id) REFERENCES warmup_batches(id),
          FOREIGN KEY (node_id) REFERENCES execution_nodes(id)
        )
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS retry_records (
          id TEXT PRIMARY KEY,
          cache_key_id TEXT NOT NULL,
          batch_id TEXT NOT NULL,
          retry_attempt INTEGER NOT NULL,
          status TEXT NOT NULL,
          node_id TEXT,
          started_at TEXT,
          completed_at TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (cache_key_id) REFERENCES cache_keys(id),
          FOREIGN KEY (batch_id) REFERENCES warmup_batches(id),
          FOREIGN KEY (node_id) REFERENCES execution_nodes(id)
        )
      `);
            db.run(`
        CREATE INDEX IF NOT EXISTS idx_cache_keys_batch_id 
        ON cache_keys(batch_id)
      `);
            db.run(`
        CREATE INDEX IF NOT EXISTS idx_failure_records_batch_id 
        ON failure_records(batch_id)
      `);
            db.run(`
        CREATE INDEX IF NOT EXISTS idx_retry_records_cache_key_id 
        ON retry_records(cache_key_id)
      `);
            resolve(db);
        });
    });
};
exports.initDatabase = initDatabase;
const getDatabase = () => {
    ensureDataDir();
    return new sqlite3_1.default.Database(getDbPath());
};
exports.getDatabase = getDatabase;
