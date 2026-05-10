const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/lab.db');
const db = new sqlite3.Database(dbPath);

const STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  OUTBOUND: 'OUTBOUND',
  PARTIAL_RETURN: 'PARTIAL_RETURN',
  FULL_RETURN: 'FULL_RETURN',
  CLOSED: 'CLOSED'
};

const STATUS_INFO = {
  DRAFT: { label: '草稿', color: '#6b7280', canEdit: true, cardColor: '#f3f4f6' },
  PENDING_APPROVAL: { label: '待导师审批', color: '#f59e0b', canEdit: false, cardColor: '#fffbeb' },
  APPROVED: { label: '已批准', color: '#10b981', canEdit: false, cardColor: '#ecfdf5' },
  REJECTED: { label: '已拒绝', color: '#ef4444', canEdit: true, cardColor: '#fef2f2' },
  OUTBOUND: { label: '已出库', color: '#3b82f6', canEdit: false, cardColor: '#eff6ff' },
  PARTIAL_RETURN: { label: '部分回收', color: '#8b5cf6', canEdit: false, cardColor: '#f5f3ff' },
  FULL_RETURN: { label: '完全回收', color: '#065f46', canEdit: false, cardColor: '#d1fae5' },
  CLOSED: { label: '已关闭', color: '#1f2937', canEdit: false, cardColor: '#e5e7eb' }
};

const STATUS_TRANSITIONS = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['OUTBOUND'],
  REJECTED: ['DRAFT'],
  OUTBOUND: ['PARTIAL_RETURN', 'FULL_RETURN'],
  PARTIAL_RETURN: ['PARTIAL_RETURN', 'FULL_RETURN'],
  FULL_RETURN: ['CLOSED'],
  CLOSED: []
};

function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS chemicals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cas_no TEXT,
        category TEXT,
        unit TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS chemical_batches (
        id TEXT PRIMARY KEY,
        chemical_id TEXT NOT NULL,
        batch_no TEXT NOT NULL,
        manufacturer TEXT,
        production_date TEXT,
        expiry_date TEXT,
        initial_quantity REAL NOT NULL,
        available_quantity REAL NOT NULL,
        location TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (chemical_id) REFERENCES chemicals(id),
        UNIQUE(chemical_id, batch_no)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS requisitions (
        id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL,
        advisor_id TEXT,
        chemical_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        requested_quantity REAL NOT NULL,
        approved_quantity REAL,
        returned_quantity REAL DEFAULT 0,
        status TEXT NOT NULL,
        purpose TEXT,
        lab_location TEXT,
        created_at TEXT,
        updated_at TEXT,
        approved_at TEXT,
        approved_by TEXT,
        rejection_reason TEXT,
        FOREIGN KEY (requester_id) REFERENCES users(id),
        FOREIGN KEY (advisor_id) REFERENCES users(id),
        FOREIGN KEY (chemical_id) REFERENCES chemicals(id),
        FOREIGN KEY (batch_id) REFERENCES chemical_batches(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS status_logs (
        id TEXT PRIMARY KEY,
        requisition_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        operator_id TEXT,
        operator_name TEXT,
        comment TEXT,
        changed_at TEXT,
        FOREIGN KEY (requisition_id) REFERENCES requisitions(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        operator_id TEXT,
        operator_name TEXT,
        changed_at TEXT
      )
    `);

    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
      if (err || row.count === 0) {
        seedData();
      }
    });
  });
}

function seedData() {
  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();

  const users = [
    { id: uuidv4(), name: '张同学', role: 'STUDENT', department: '化学系' },
    { id: uuidv4(), name: '李同学', role: 'STUDENT', department: '环境系' },
    { id: uuidv4(), name: '王教授', role: 'ADVISOR', department: '化学系' },
    { id: uuidv4(), name: '刘教授', role: 'ADVISOR', department: '环境系' },
    { id: uuidv4(), name: '管理员', role: 'ADMIN', department: '实验室管理处' }
  ];

  const chemicals = [
    { id: uuidv4(), name: '硫酸', cas_no: '7664-93-9', category: '腐蚀品', unit: 'mL' },
    { id: uuidv4(), name: '盐酸', cas_no: '7647-01-0', category: '腐蚀品', unit: 'mL' },
    { id: uuidv4(), name: '乙醇', cas_no: '64-17-5', category: '易燃液体', unit: 'mL' },
    { id: uuidv4(), name: '丙酮', cas_no: '67-64-1', category: '易燃液体', unit: 'mL' },
    { id: uuidv4(), name: '氢氧化钠', cas_no: '1310-73-2', category: '腐蚀品', unit: 'g' }
  ];

  const batches = [
    { id: uuidv4(), chemical_id: chemicals[0].id, batch_no: 'H2SO4-2024-001', manufacturer: '国药试剂', production_date: '2024-01-15', expiry_date: '2026-01-15', initial_quantity: 5000, available_quantity: 5000, location: 'A区-腐蚀品柜1号' },
    { id: uuidv4(), chemical_id: chemicals[0].id, batch_no: 'H2SO4-2024-002', manufacturer: '阿拉丁', production_date: '2024-03-20', expiry_date: '2026-03-20', initial_quantity: 3000, available_quantity: 3000, location: 'A区-腐蚀品柜1号' },
    { id: uuidv4(), chemical_id: chemicals[1].id, batch_no: 'HCL-2024-001', manufacturer: '国药试剂', production_date: '2024-02-01', expiry_date: '2026-02-01', initial_quantity: 4000, available_quantity: 4000, location: 'A区-腐蚀品柜2号' },
    { id: uuidv4(), chemical_id: chemicals[2].id, batch_no: 'ETOH-2024-001', manufacturer: '阿拉丁', production_date: '2024-01-10', expiry_date: '2025-01-10', initial_quantity: 10000, available_quantity: 10000, location: 'B区-易燃品柜1号' },
    { id: uuidv4(), chemical_id: chemicals[3].id, batch_no: 'ACE-2024-001', manufacturer: '国药试剂', production_date: '2024-02-15', expiry_date: '2025-02-15', initial_quantity: 2000, available_quantity: 2000, location: 'B区-易燃品柜2号' },
    { id: uuidv4(), chemical_id: chemicals[4].id, batch_no: 'NAOH-2024-001', manufacturer: '阿拉丁', production_date: '2024-03-01', expiry_date: '2027-03-01', initial_quantity: 500, available_quantity: 500, location: 'A区-腐蚀品柜3号' }
  ];

  const stmtUser = db.prepare("INSERT INTO users (id, name, role, department) VALUES (?, ?, ?, ?)");
  users.forEach(u => stmtUser.run(u.id, u.name, u.role, u.department));
  stmtUser.finalize();

  const stmtChem = db.prepare("INSERT INTO chemicals (id, name, cas_no, category, unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  chemicals.forEach(c => stmtChem.run(c.id, c.name, c.cas_no, c.category, c.unit, now, now));
  stmtChem.finalize();

  const stmtBatch = db.prepare("INSERT INTO chemical_batches (id, chemical_id, batch_no, manufacturer, production_date, expiry_date, initial_quantity, available_quantity, location, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  batches.forEach(b => stmtBatch.run(b.id, b.chemical_id, b.batch_no, b.manufacturer, b.production_date, b.expiry_date, b.initial_quantity, b.available_quantity, b.location, now, now));
  stmtBatch.finalize();
}

module.exports = { db, STATUSES, STATUS_INFO, STATUS_TRANSITIONS, initDatabase };
