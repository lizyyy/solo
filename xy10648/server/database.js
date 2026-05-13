const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/expense.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS club_budgets (
    id TEXT PRIMARY KEY,
    club_name TEXT NOT NULL,
    fiscal_year TEXT NOT NULL,
    total_amount REAL NOT NULL,
    used_amount REAL DEFAULT 0,
    remaining_amount REAL NOT NULL,
    status TEXT DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS budget_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_id TEXT NOT NULL,
    before_data TEXT,
    after_data TEXT,
    modified_by TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    FOREIGN KEY (budget_id) REFERENCES club_budgets(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS activity_applications (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    activity_name TEXT NOT NULL,
    activity_date TEXT NOT NULL,
    location TEXT NOT NULL,
    expected_participants INTEGER NOT NULL,
    estimated_amount REAL NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    applicant TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    FOREIGN KEY (budget_id) REFERENCES club_budgets(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS activity_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id TEXT NOT NULL,
    before_data TEXT,
    after_data TEXT,
    modified_by TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    FOREIGN KEY (activity_id) REFERENCES activity_applications(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    supplier TEXT,
    purchase_date TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    FOREIGN KEY (activity_id) REFERENCES activity_applications(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS purchase_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id TEXT NOT NULL,
    before_data TEXT,
    after_data TEXT,
    modified_by TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchase_items(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS invoice_reviews (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL,
    invoice_number TEXT,
    invoice_amount REAL NOT NULL,
    invoice_date TEXT,
    vendor_name TEXT,
    invoice_url TEXT,
    status TEXT DEFAULT 'pending',
    reviewer TEXT,
    review_comment TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (activity_id) REFERENCES activity_applications(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS supplement_requests (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    request_type TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    requested_by TEXT NOT NULL,
    responded_by TEXT,
    response TEXT,
    responded_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (review_id) REFERENCES invoice_reviews(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS payment_progress (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL,
    request_id TEXT UNIQUE NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    transaction_id TEXT,
    paid_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (activity_id) REFERENCES activity_applications(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    operator TEXT NOT NULL,
    details TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL
  )`);
});

module.exports = db;
