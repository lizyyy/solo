const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('./config');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = config.database.path;
  }

  async init() {
    const SQL = await initSqlJs();
    
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this._createTables();
    this._save();
  }

  _createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS app_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'GET',
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(path, method)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS rate_limit_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_key_id INTEGER,
        route_id INTEGER,
        algorithm TEXT NOT NULL DEFAULT 'fixed-window',
        request_limit INTEGER NOT NULL DEFAULT 100,
        window_seconds INTEGER NOT NULL DEFAULT 60,
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (app_key_id) REFERENCES app_keys(id),
        FOREIGN KEY (route_id) REFERENCES routes(id),
        UNIQUE(app_key_id, route_id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_key_id INTEGER,
        route_id INTEGER,
        request_id TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        algorithm TEXT NOT NULL,
        request_limit INTEGER NOT NULL,
        window_seconds INTEGER NOT NULL,
        count_in_window INTEGER NOT NULL,
        action TEXT NOT NULL,
        window_start TIMESTAMP,
        window_end TIMESTAMP,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (app_key_id) REFERENCES app_keys(id),
        FOREIGN KEY (route_id) REFERENCES routes(id)
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_request_logs_app_key ON request_logs(app_key_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_request_logs_route ON request_logs(route_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_request_logs_action ON request_logs(action)`);
  }

  _save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  run(sql, params = []) {
    this.db.run(sql, params);
    const lastInsertRowid = this._getLastInsertRowid();
    const changes = this._getChanges();
    this._save();
    return { lastInsertRowid, changes };
  }

  _getLastInsertRowid() {
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0];
    }
    return null;
  }

  _getChanges() {
    const result = this.db.exec('SELECT changes() as changes');
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0];
    }
    return 0;
  }

  get(sql, params = []) {
    const result = this.db.exec(sql, params);
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    const columns = result[0].columns;
    const values = result[0].values[0];
    const row = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    return row;
  }

  all(sql, params = []) {
    const result = this.db.exec(sql, params);
    if (result.length === 0) {
      return [];
    }
    const columns = result[0].columns;
    return result[0].values.map(values => {
      const row = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      return row;
    });
  }

  close() {
    if (this.db) {
      this._save();
      this.db.close();
    }
  }
}

module.exports = new Database();
