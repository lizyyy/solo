const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../config');
const fs = require('fs');

const dbPath = config.database.filename;
const dbDir = path.dirname(dbPath);

// 确保数据目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

class Database {
  constructor() {
    if (dbInstance) {
      return dbInstance;
    }
    this.db = null;
    dbInstance = this;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('数据库连接失败:', err);
          reject(err);
        } else {
          console.log('数据库连接成功');
          resolve(this.db);
        }
      });

      // 启用外键约束
      this.db.run('PRAGMA foreign_keys = ON');
    });
  }

  disconnect() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          console.error('数据库关闭失败:', err);
          reject(err);
        } else {
          console.log('数据库已关闭');
          this.db = null;
          resolve();
        }
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async init() {
    await this.connect();

    // 创建试剂表
    const createChemicalsTable = `
      CREATE TABLE IF NOT EXISTS chemicals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        english_name TEXT,
        cas_number TEXT,
        formula TEXT,
        danger_level TEXT NOT NULL,
        description TEXT,
        storage_requirements TEXT,
        unit TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT
      )
    `;

    // 创建批次表
    const createBatchesTable = `
      CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        chemical_id TEXT NOT NULL,
        batch_number TEXT NOT NULL UNIQUE,
        production_date TEXT,
        expiry_date TEXT NOT NULL,
        initial_quantity REAL NOT NULL,
        current_quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        supplier TEXT,
        manufacturer TEXT,
        storage_location TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (chemical_id) REFERENCES chemicals(id)
      )
    `;

    // 创建领用申请表
    const createRequestsTable = `
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        request_number TEXT NOT NULL UNIQUE,
        requester_id TEXT NOT NULL,
        requester_name TEXT,
        chemical_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        purpose TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        approver_id TEXT,
        approver_name TEXT,
        approved_at TEXT,
        rejection_reason TEXT,
        executor_id TEXT,
        executor_name TEXT,
        executed_at TEXT,
        returned_at TEXT,
        return_quantity REAL,
        disposed_at TEXT,
        disposal_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (chemical_id) REFERENCES chemicals(id),
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )
    `;

    // 创建审计日志表
    const createAuditLogsTable = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        entity_name TEXT,
        description TEXT,
        old_value TEXT,
        new_value TEXT,
        user_id TEXT NOT NULL,
        user_name TEXT,
        user_role TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL
      )
    `;

    // 创建索引
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_chemicals_name ON chemicals(name)',
      'CREATE INDEX IF NOT EXISTS idx_chemicals_danger_level ON chemicals(danger_level)',
      'CREATE INDEX IF NOT EXISTS idx_batches_chemical_id ON batches(chemical_id)',
      'CREATE INDEX IF NOT EXISTS idx_batches_batch_number ON batches(batch_number)',
      'CREATE INDEX IF NOT EXISTS idx_batches_expiry_date ON batches(expiry_date)',
      'CREATE INDEX IF NOT EXISTS idx_requests_requester_id ON requests(requester_id)',
      'CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_requests_request_number ON requests(request_number)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)'
    ];

    try {
      await this.run(createChemicalsTable);
      await this.run(createBatchesTable);
      await this.run(createRequestsTable);
      await this.run(createAuditLogsTable);

      for (const indexSql of createIndexes) {
        await this.run(indexSql);
      }

      console.log('数据库表和索引初始化完成');
    } catch (err) {
      console.error('数据库初始化失败:', err);
      throw err;
    }
  }

  async transaction(callback) {
    await this.run('BEGIN TRANSACTION');
    try {
      const result = await callback(this);
      await this.run('COMMIT');
      return result;
    } catch (err) {
      await this.run('ROLLBACK');
      throw err;
    }
  }
}

module.exports = new Database();
