const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'specimen.db');

let db = null;

function getDb() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function initDatabase() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('数据库连接失败:', err);
      throw err;
    }
    console.log('SQLite 数据库连接成功');
  });

  await createTables();
}

async function createTables() {
  const createSpecimenTable = `
    CREATE TABLE IF NOT EXISTS specimens (
      id TEXT PRIMARY KEY,
      barcode TEXT UNIQUE NOT NULL,
      patient_name TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      specimen_type TEXT NOT NULL,
      collection_time DATETIME NOT NULL,
      source_department TEXT,
      destination_lab TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      batch_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `;

  const createBatchTable = `
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batch_number TEXT UNIQUE NOT NULL,
      destination_lab TEXT NOT NULL,
      courier TEXT,
      scheduled_time DATETIME,
      actual_shipped_time DATETIME,
      delivered_time DATETIME,
      status TEXT NOT NULL DEFAULT 'created',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createChainSegmentTable = `
    CREATE TABLE IF NOT EXISTS chain_segments (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      segment_type TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      start_location TEXT NOT NULL,
      end_location TEXT,
      temperature_min REAL,
      temperature_max REAL,
      temperature_avg REAL,
      operator TEXT,
      status TEXT NOT NULL DEFAULT 'in_progress',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `;

  const createReportTable = `
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      specimen_id TEXT NOT NULL,
      batch_id TEXT,
      report_number TEXT UNIQUE NOT NULL,
      report_type TEXT,
      result TEXT,
      conclusion TEXT,
      reporter TEXT,
      reviewed_by TEXT,
      generated_time DATETIME,
      reviewed_time DATETIME,
      finalized_time DATETIME,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (specimen_id) REFERENCES specimens(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `;

  const createStatusHistoryTable = `
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createSpecimenIndex = 'CREATE INDEX IF NOT EXISTS idx_specimens_barcode ON specimens(barcode)';
  const createSpecimenStatusIndex = 'CREATE INDEX IF NOT EXISTS idx_specimens_status ON specimens(status)';
  const createSpecimenBatchIndex = 'CREATE INDEX IF NOT EXISTS idx_specimens_batch_id ON specimens(batch_id)';
  const createBatchStatusIndex = 'CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status)';
  const createChainBatchIndex = 'CREATE INDEX IF NOT EXISTS idx_chain_batch_id ON chain_segments(batch_id)';
  const createReportSpecimenIndex = 'CREATE INDEX IF NOT EXISTS idx_reports_specimen_id ON reports(specimen_id)';
  const createReportBatchIndex = 'CREATE INDEX IF NOT EXISTS idx_reports_batch_id ON reports(batch_id)';

  await run(createSpecimenTable);
  await run(createBatchTable);
  await run(createChainSegmentTable);
  await run(createReportTable);
  await run(createStatusHistoryTable);

  await run(createSpecimenIndex);
  await run(createSpecimenStatusIndex);
  await run(createSpecimenBatchIndex);
  await run(createBatchStatusIndex);
  await run(createChainBatchIndex);
  await run(createReportSpecimenIndex);
  await run(createReportBatchIndex);

  console.log('数据库表和索引创建完成');
}

module.exports = {
  initDatabase,
  getDb,
  run,
  get,
  all,
  DB_PATH
};
