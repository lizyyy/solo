const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

class DatabaseManager {
  constructor() {
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.dbPath = config.database.path;
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
      }
    });
    
    this.initPromise = this.initTables().then(() => this.initDefaultUsers());
  }

  async initTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        id_card TEXT,
        company TEXT,
        purpose TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id INTEGER NOT NULL,
        visitor_name TEXT NOT NULL,
        visitor_phone TEXT NOT NULL,
        plate_number TEXT,
        visit_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status TEXT DEFAULT 'pending',
        approved_by TEXT,
        approved_at DATETIME,
        cancelled_at DATETIME,
        gate TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (visitor_id) REFERENCES visitors (id)
      )`,
      `CREATE TABLE IF NOT EXISTS temporary_plates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT NOT NULL UNIQUE,
        visitor_name TEXT NOT NULL,
        visitor_phone TEXT NOT NULL,
        valid_from DATETIME NOT NULL,
        valid_to DATETIME NOT NULL,
        status TEXT DEFAULT 'active',
        appointment_id INTEGER,
        issued_by TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments (id)
      )`,
      `CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        reason TEXT NOT NULL,
        added_by TEXT NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        is_active INTEGER DEFAULT 1,
        notes TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS verification_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        verify_type TEXT NOT NULL,
        identifier TEXT NOT NULL,
        result TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        gate TEXT,
        operator_id TEXT,
        operator_name TEXT,
        appointment_id INTEGER,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operator_id TEXT,
        operator_name TEXT,
        operation TEXT NOT NULL,
        module TEXT NOT NULL,
        record_id INTEGER,
        old_value TEXT,
        new_value TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }

    await this.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_blacklist_type_value ON blacklist (type, value)');
  }

  async initDefaultUsers() {
    const count = await this.get('SELECT COUNT(*) as count FROM users');
    if (count.count === 0) {
      const defaultUsers = [
        { username: 'admin', password: 'admin123', name: '系统管理员', role: 'super_admin', phone: '13800138000' },
        { username: 'manager', password: 'manager123', name: '安保主管', role: 'security_manager', phone: '13800138001' },
        { username: 'guard1', password: 'guard123', name: '门岗保安1', role: 'gate_guard', phone: '13800138002' }
      ];
      for (const user of defaultUsers) {
        await this.run(
          'INSERT INTO users (username, password, name, role, phone) VALUES (?, ?, ?, ?, ?)',
          [user.username, user.password, user.name, user.role, user.phone]
        );
      }
    }
  }

  async waitForInit() {
    await this.initPromise;
  }

  getConnection() {
    return this.db;
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = new DatabaseManager();
