const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

const dbPath = path.join(__dirname, 'medicine_box.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS medicine_boxes (
    id TEXT PRIMARY KEY,
    location_name TEXT NOT NULL,
    address TEXT NOT NULL,
    manager TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS medicine_batches (
    id TEXT PRIMARY KEY,
    box_id TEXT NOT NULL,
    medicine_name TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL,
    production_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    supplier TEXT NOT NULL,
    status TEXT DEFAULT 'normal',
    expiry_risk INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (box_id) REFERENCES medicine_boxes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS residents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    id_card TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS borrow_records (
    id TEXT PRIMARY KEY,
    resident_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    box_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    borrow_reason TEXT NOT NULL,
    borrow_date TEXT NOT NULL,
    expected_return_date TEXT NOT NULL,
    actual_return_date TEXT,
    status TEXT DEFAULT 'borrowed',
    operator TEXT NOT NULL,
    reviewer TEXT,
    review_time TEXT,
    review_comment TEXT,
    before_values TEXT,
    after_values TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (resident_id) REFERENCES residents(id),
    FOREIGN KEY (batch_id) REFERENCES medicine_batches(id),
    FOREIGN KEY (box_id) REFERENCES medicine_boxes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS return_inspections (
    id TEXT PRIMARY KEY,
    borrow_id TEXT NOT NULL,
    inspection_date TEXT NOT NULL,
    inspector TEXT NOT NULL,
    quantity_actual INTEGER NOT NULL,
    condition TEXT NOT NULL,
    remarks TEXT,
    status TEXT DEFAULT 'pending',
    before_values TEXT,
    after_values TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (borrow_id) REFERENCES borrow_records(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS supply_plans (
    id TEXT PRIMARY KEY,
    box_id TEXT NOT NULL,
    medicine_name TEXT NOT NULL,
    planned_quantity INTEGER NOT NULL,
    unit TEXT NOT NULL,
    planned_date TEXT NOT NULL,
    actual_date TEXT,
    supplier TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    responsible_person TEXT NOT NULL,
    remarks TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (box_id) REFERENCES medicine_boxes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    module TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operator TEXT NOT NULL,
    operation_time TEXT NOT NULL,
    before_values TEXT,
    after_values TEXT,
    remarks TEXT,
    ip_address TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS expiry_risk_records (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    risk_date TEXT NOT NULL,
    days_to_expiry INTEGER NOT NULL,
    processed INTEGER DEFAULT 0,
    processed_by TEXT,
    processed_time TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES medicine_batches(id)
  )`);
});

const calculateExpiryRisk = () => {
  const today = moment();
  db.all(`SELECT * FROM medicine_batches WHERE status = 'normal'`, [], (err, batches) => {
    if (err) {
      console.error('计算效期风险错误:', err);
      return;
    }

    batches.forEach(batch => {
      const expiryDate = moment(batch.expiry_date);
      const daysToExpiry = expiryDate.diff(today, 'days');
      
      let riskLevel = null;
      if (daysToExpiry <= 0) {
        riskLevel = 'expired';
      } else if (daysToExpiry <= 30) {
        riskLevel = 'critical';
      } else if (daysToExpiry <= 90) {
        riskLevel = 'warning';
      }

      if (riskLevel) {
        db.get(`SELECT id FROM expiry_risk_records WHERE batch_id = ? AND processed = 0`, [batch.id], (err, existing) => {
          if (!existing) {
            const { v4: uuidv4 } = require('uuid');
            db.run(`INSERT INTO expiry_risk_records (id, batch_id, risk_level, risk_date, days_to_expiry, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)`,
              [uuidv4(), batch.id, riskLevel, today.format('YYYY-MM-DD'), daysToExpiry, today.format('YYYY-MM-DD HH:mm:ss')]
            );
          }
        });
      }
    });
  });
};

module.exports = { db, calculateExpiryRisk };
