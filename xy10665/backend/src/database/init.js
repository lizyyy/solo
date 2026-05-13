const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/complaints.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content_url TEXT,
    creator_id TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS content_items_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES content_items(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rights_holders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    id_card TEXT,
    company_name TEXT,
    business_license TEXT,
    verification_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rights_holders_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    holder_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (holder_id) REFERENCES rights_holders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS complaint_evidences (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    evidence_url TEXT,
    description TEXT,
    uploaded_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS complaint_evidences_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evidence_id) REFERENCES complaint_evidences(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS takedown_status (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    status TEXT NOT NULL,
    handler TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    holder_id TEXT NOT NULL,
    complaint_reason TEXT NOT NULL,
    complaint_details TEXT,
    current_status TEXT DEFAULT 'pending',
    handler TEXT,
    handled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES content_items(id),
    FOREIGN KEY (holder_id) REFERENCES rights_holders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS complaints_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS creator_appeals (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    appeal_reason TEXT NOT NULL,
    appeal_details TEXT,
    status TEXT DEFAULT 'pending',
    reviewer TEXT,
    review_notes TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS compliance_materials (
    id TEXT PRIMARY KEY,
    appeal_id TEXT NOT NULL,
    material_type TEXT NOT NULL,
    material_url TEXT,
    description TEXT,
    uploaded_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appeal_id) REFERENCES creator_appeals(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS idempotency_keys (
    id TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    response_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
  )`);

  console.log('数据库表创建完成');
});

db.close();
