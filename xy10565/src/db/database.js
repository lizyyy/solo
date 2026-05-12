const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.SQL = null;
    this._ready = false;
  }

  async initialize() {
    if (this._ready) return;

    this.SQL = await initSqlJs();
    
    const dbPath = config.db.path;
    
    if (fs.existsSync(dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(dbPath);
        this.db = new this.SQL.Database(fileBuffer);
      } catch (err) {
        console.warn('读取数据库文件失败，创建新数据库:', err.message);
        this.db = new this.SQL.Database();
      }
    } else {
      this.db = new this.SQL.Database();
    }

    this._ready = true;
  }

  ensureReady() {
    if (!this._ready || !this.db) {
      throw new Error('数据库未初始化，请先调用 initialize()');
    }
  }

  close() {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
      this._ready = false;
    }
  }

  save() {
    if (!this.db) return;
    
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      
      const dbDir = path.dirname(config.db.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      fs.writeFileSync(config.db.path, buffer);
    } catch (err) {
      console.error('保存数据库失败:', err);
    }
  }

  run(sql, params = []) {
    this.ensureReady();
    this.db.run(sql, params);
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  get(sql, params = []) {
    this.ensureReady();
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(sql, params = []) {
    this.ensureReady();
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  exec(sql) {
    this.ensureReady();
    const results = this.db.exec(sql);
    this.save();
    return results;
  }

  prepare(sql) {
    this.ensureReady();
    return this.db.prepare(sql);
  }

  transaction(callback) {
    this.ensureReady();
    this.db.run('BEGIN TRANSACTION');
    try {
      const result = callback();
      this.db.run('COMMIT');
      this.save();
      return result;
    } catch (err) {
      this.db.run('ROLLBACK');
      throw err;
    }
  }
}

const dbManager = new DatabaseManager();

module.exports = dbManager;
