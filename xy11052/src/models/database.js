const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/inspection.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
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

const initTables = async () => {
  const db = new Database();
  
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS stores (
        store_id TEXT PRIMARY KEY,
        store_name TEXT NOT NULL,
        franchisee_name TEXT,
        store_address TEXT,
        region TEXT,
        open_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS inspections (
        inspection_id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        inspector_id TEXT NOT NULL,
        inspector_name TEXT NOT NULL,
        inspection_date TEXT NOT NULL,
        inspection_type TEXT NOT NULL,
        overall_score INTEGER,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(store_id)
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS rectification_items (
        item_id TEXT PRIMARY KEY,
        inspection_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        problem_category TEXT NOT NULL,
        problem_type TEXT NOT NULL,
        problem_description TEXT NOT NULL,
        problem_location TEXT,
        photo_url TEXT,
        photo_hash TEXT,
        requirement TEXT NOT NULL,
        deadline TEXT NOT NULL,
        responsible_person TEXT,
        status TEXT DEFAULT 'pending',
        remark TEXT,
        is_conflict INTEGER DEFAULT 0,
        conflict_type TEXT,
        conflict_remark TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inspection_id) REFERENCES inspections(inspection_id),
        FOREIGN KEY (store_id) REFERENCES stores(store_id)
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS rectification_records (
        record_id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        rectify_date TEXT NOT NULL,
        rectify_description TEXT NOT NULL,
        rectify_photo_url TEXT,
        rectify_photo_hash TEXT,
        rectify_person TEXT NOT NULL,
        status TEXT DEFAULT 'submitted',
        auditor_id TEXT,
        auditor_name TEXT,
        audit_remark TEXT,
        audit_time TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES rectification_items(item_id)
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS import_errors (
        error_id TEXT PRIMARY KEY,
        import_batch_id TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        original_data TEXT NOT NULL,
        error_reason TEXT NOT NULL,
        suggestion TEXT NOT NULL,
        error_type TEXT NOT NULL,
        resolved INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS remark_logs (
        log_id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        remark TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        previous_status TEXT,
        new_status TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES rectification_items(item_id)
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS status_flow_rules (
        rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
        current_status TEXT NOT NULL,
        next_status TEXT NOT NULL,
        allowed_roles TEXT NOT NULL,
        description TEXT
      )
    `);

    console.log('数据库表初始化完成');
  } catch (error) {
    console.error('初始化数据库表失败:', error);
    throw error;
  } finally {
    await db.close();
  }
};

const initStatusFlowRules = async () => {
  const db = new Database();
  
  try {
    const rules = [
      { current: 'pending', next: 'rectifying', roles: 'inspector,store_manager', desc: '待整改 -> 整改中' },
      { current: 'rectifying', next: 'submitted', roles: 'store_manager', desc: '整改中 -> 已提交' },
      { current: 'submitted', next: 'approved', roles: 'inspector,supervisor', desc: '已提交 -> 验收通过' },
      { current: 'submitted', next: 'rejected', roles: 'inspector,supervisor', desc: '已提交 -> 验收驳回' },
      { current: 'rejected', next: 'rectifying', roles: 'store_manager', desc: '验收驳回 -> 重新整改' },
      { current: 'approved', next: 'closed', roles: 'supervisor', desc: '验收通过 -> 已关闭' },
    ];

    for (const rule of rules) {
      await db.run(
        'INSERT OR IGNORE INTO status_flow_rules (current_status, next_status, allowed_roles, description) VALUES (?, ?, ?, ?)',
        [rule.current, rule.next, rule.roles, rule.desc]
      );
    }

    console.log('状态流转规则初始化完成');
  } catch (error) {
    console.error('初始化状态流转规则失败:', error);
    throw error;
  } finally {
    await db.close();
  }
};

module.exports = { Database, initTables, initStatusFlowRules, DB_PATH };