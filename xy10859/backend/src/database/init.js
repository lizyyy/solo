const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/masking.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS export_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_code TEXT UNIQUE NOT NULL,
    role_name TEXT NOT NULL,
    description TEXT,
    strategy_version TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS field_strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    masking_type TEXT NOT NULL,
    masking_pattern TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES export_roles(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS masking_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_id INTEGER NOT NULL,
    original_value TEXT NOT NULL,
    masked_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (strategy_id) REFERENCES field_strategies(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS export_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT UNIQUE NOT NULL,
    role_id INTEGER NOT NULL,
    task_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    parameters TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    need_approval INTEGER DEFAULT 0,
    approved_by TEXT,
    approved_at DATETIME,
    file_path TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES export_roles(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS approval_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    approver TEXT NOT NULL,
    action TEXT NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES export_tasks(task_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS download_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    downloaded_by TEXT NOT NULL,
    download_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES export_tasks(task_id)
  )`);

  const roles = [
    { code: 'admin', name: '管理员', version: 'v2.0' },
    { code: 'operator', name: '运营人员', version: 'v2.0' },
    { code: 'customer_service', name: '客服人员', version: 'v1.0' },
    { code: 'auditor', name: '审计人员', version: 'v2.0' }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO export_roles (role_code, role_name, strategy_version, description) VALUES (?, ?, ?, ?)');
  roles.forEach(r => stmt.run(r.code, r.name, r.version, `${r.name}导出权限`));
  stmt.finalize();

  const strategies = [
    { role: 'admin', field: 'phone', type: 'none', pattern: '' },
    { role: 'admin', field: 'id_card', type: 'none', pattern: '' },
    { role: 'operator', field: 'phone', type: 'middle', pattern: '138****1234' },
    { role: 'operator', field: 'id_card', type: 'middle', pattern: '110101********1234' },
    { role: 'customer_service', field: 'phone', type: 'full', pattern: '***********' },
    { role: 'customer_service', field: 'id_card', type: 'full', pattern: '******************' },
    { role: 'auditor', field: 'phone', type: 'last4', pattern: '****1234' },
    { role: 'auditor', field: 'id_card', type: 'last4', pattern: '************1234' }
  ];

  db.all('SELECT id, role_code FROM export_roles', (err, rows) => {
    if (err) return;
    const roleMap = {};
    rows.forEach(r => roleMap[r.role_code] = r.id);
    
    const stmt2 = db.prepare('INSERT OR IGNORE INTO field_strategies (role_id, field_name, masking_type, masking_pattern) VALUES (?, ?, ?, ?)');
    strategies.forEach(s => {
      if (roleMap[s.role]) {
        stmt2.run(roleMap[s.role], s.field, s.type, s.pattern);
      }
    });
    stmt2.finalize();
  });

  console.log('数据库初始化完成');
});

module.exports = db;