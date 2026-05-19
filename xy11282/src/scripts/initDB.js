const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pharmacy.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('开始初始化数据库...');

  db.run(`CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    specification TEXT,
    manufacturer TEXT,
    dosageMin REAL NOT NULL,
    dosageMax REAL NOT NULL,
    dosageUnit TEXT DEFAULT 'mg/kg',
    frequency TEXT,
    contraindications TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('✓ 药品表创建完成');

  db.run(`CREATE TABLE IF NOT EXISTS pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT,
    weight REAL NOT NULL,
    weightUnit TEXT DEFAULT 'kg',
    age INTEGER,
    gender TEXT,
    ownerName TEXT,
    ownerPhone TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('✓ 宠物表创建完成');

  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicineId INTEGER NOT NULL,
    batchNumber TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT DEFAULT '片',
    productionDate DATE,
    expiryDate DATE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicineId) REFERENCES medicines(id)
  )`);
  console.log('✓ 库存表创建完成');

  db.run(`CREATE TABLE IF NOT EXISTS prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    petId INTEGER NOT NULL,
    doctor TEXT NOT NULL,
    diagnosis TEXT,
    status TEXT DEFAULT 'pending',
    totalAmount REAL,
    reviewNotes TEXT,
    reviewedBy TEXT,
    reviewedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (petId) REFERENCES pets(id)
  )`);
  console.log('✓ 处方表创建完成');

  db.run(`CREATE TABLE IF NOT EXISTS prescription_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prescriptionId INTEGER NOT NULL,
    medicineId INTEGER NOT NULL,
    inventoryId INTEGER NOT NULL,
    dosage REAL NOT NULL,
    dosageUnit TEXT DEFAULT 'mg/kg',
    totalDosage REAL NOT NULL,
    quantity INTEGER NOT NULL,
    notes TEXT,
    checkStatus TEXT DEFAULT 'passed',
    checkReason TEXT,
    FOREIGN KEY (prescriptionId) REFERENCES prescriptions(id),
    FOREIGN KEY (medicineId) REFERENCES medicines(id),
    FOREIGN KEY (inventoryId) REFERENCES inventory(id)
  )`);
  console.log('✓ 处方明细表创建完成');

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    targetId INTEGER NOT NULL,
    action TEXT NOT NULL,
    operator TEXT NOT NULL,
    reason TEXT,
    oldValue TEXT,
    newValue TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('✓ 审核日志表创建完成');

  db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_medicine ON inventory(medicineId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_prescription_pet ON prescriptions(petId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescriptionId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(type, targetId)`);
  console.log('✓ 索引创建完成');

  console.log('\n数据库初始化成功!');
});

db.close();
