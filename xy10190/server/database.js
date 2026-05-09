const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '../data/app.db');

let db;

const init = () => {
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('数据库连接失败:', err.message);
      process.exit(1);
    }
    console.log('已连接到 SQLite 数据库');
    createTables();
  });
};

const createTables = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'hr',
      email TEXT,
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      position TEXT NOT NULL,
      department TEXT,
      status TEXT NOT NULL DEFAULT 'interviewing',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      base_salary DECIMAL(12,2) NOT NULL,
      bonus DECIMAL(12,2) DEFAULT 0,
      benefits TEXT,
      start_date DATE NOT NULL,
      probation_period INTEGER DEFAULT 3,
      work_location TEXT,
      approver_ids TEXT NOT NULL,
      current_approver_index INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      is_accepted BOOLEAN DEFAULT 0,
      accepted_at DATETIME,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      parent_offer_id TEXT,
      change_reason TEXT,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id),
      FOREIGN KEY (parent_offer_id) REFERENCES offers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS approval_records (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL,
      approver_id TEXT NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      approver_order INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (offer_id) REFERENCES offers(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_offers_candidate ON offers(candidate_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_approvals_offer ON approval_records(offer_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)`);
  });
};

const initializeDemoData = () => {
  db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
    if (err || row.count > 0) return;

    const salt = bcrypt.genSaltSync(10);
    
    const users = [
      { id: 'user-1', username: 'hr_admin', password: bcrypt.hashSync('password123', salt), name: 'HR管理员', role: 'hr_admin', email: 'hr@example.com', department: '人力资源部' },
      { id: 'user-2', username: 'manager1', password: bcrypt.hashSync('password123', salt), name: '部门经理张', role: 'manager', email: 'zhang@example.com', department: '技术部' },
      { id: 'user-3', username: 'manager2', password: bcrypt.hashSync('password123', salt), name: '部门经理李', role: 'manager', email: 'li@example.com', department: '市场部' },
      { id: 'user-4', username: 'director', password: bcrypt.hashSync('password123', salt), name: '总监王', role: 'director', email: 'wang@example.com', department: '总经办' }
    ];

    const stmt = db.prepare(`INSERT INTO users (id, username, password, name, role, email, department) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    users.forEach(u => stmt.run(u.id, u.username, u.password, u.name, u.role, u.email, u.department));
    stmt.finalize();

    const candidates = [
      { id: 'cand-1', name: '候选人张三', phone: '13800138001', email: 'zhangsan@example.com', position: '高级前端工程师', department: '技术部', status: 'offer_sent' },
      { id: 'cand-2', name: '候选人李四', phone: '13800138002', email: 'lisi@example.com', position: '产品经理', department: '产品部', status: 'interviewing' },
      { id: 'cand-3', name: '候选人王五', phone: '13800138003', email: 'wangwu@example.com', position: '市场专员', department: '市场部', status: 'offer_accepted' }
    ];

    const candStmt = db.prepare(`INSERT INTO candidates (id, name, phone, email, position, department, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    candidates.forEach(c => candStmt.run(c.id, c.name, c.phone, c.email, c.position, c.department, c.status));
    candStmt.finalize();

    const offers = [
      { id: 'offer-1', candidate_id: 'cand-1', version: 1, base_salary: 25000, bonus: 50000, benefits: '五险一金、年度体检、带薪年假15天', start_date: '2026-06-01', probation_period: 3, work_location: '北京市朝阳区', approver_ids: '["user-2","user-4"]', current_approver_index: 1, status: 'pending_approval', created_by: 'user-1' },
      { id: 'offer-2', candidate_id: 'cand-3', version: 2, base_salary: 18000, bonus: 36000, benefits: '五险一金、年度体检、带薪年假10天', start_date: '2026-05-20', probation_period: 2, work_location: '上海市浦东新区', approver_ids: '["user-3","user-4"]', current_approver_index: 2, status: 'approved', is_accepted: 1, accepted_at: '2026-05-05 10:30:00', created_by: 'user-1', change_reason: '候选人要求薪资调整' }
    ];

    const offerStmt = db.prepare(`INSERT INTO offers (id, candidate_id, version, base_salary, bonus, benefits, start_date, probation_period, work_location, approver_ids, current_approver_index, status, is_accepted, accepted_at, created_by, change_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    offers.forEach(o => offerStmt.run(o.id, o.candidate_id, o.version, o.base_salary, o.bonus, o.benefits, o.start_date, o.probation_period, o.work_location, o.approver_ids, o.current_approver_index, o.status, o.is_accepted, o.accepted_at, o.created_by, o.change_reason));
    offerStmt.finalize();

    const approvals = [
      { id: 'appr-1', offer_id: 'offer-1', approver_id: 'user-2', action: 'approve', comment: '薪资合理，同意', approver_order: 1 },
      { id: 'appr-2', offer_id: 'offer-2', approver_id: 'user-3', action: 'approve', comment: '同意', approver_order: 1 },
      { id: 'appr-3', offer_id: 'offer-2', approver_id: 'user-4', action: 'approve', comment: '已阅', approver_order: 2 }
    ];

    const apprStmt = db.prepare(`INSERT INTO approval_records (id, offer_id, approver_id, action, comment, approver_order) VALUES (?, ?, ?, ?, ?, ?)`);
    approvals.forEach(a => apprStmt.run(a.id, a.offer_id, a.approver_id, a.action, a.comment, a.approver_order));
    apprStmt.finalize();

    console.log('演示数据已初始化');
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  init,
  initializeDemoData,
  run,
  get,
  all
};
