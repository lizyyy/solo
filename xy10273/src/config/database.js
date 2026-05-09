const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/sample-archive.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

const initTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        store_name TEXT NOT NULL,
        activity_name TEXT NOT NULL,
        activity_date TEXT NOT NULL,
        product_name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        activity_id TEXT NOT NULL,
        batch_number TEXT NOT NULL,
        production_date TEXT NOT NULL,
        expiration_date TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (activity_id) REFERENCES activities(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sample_archives (
        id TEXT PRIMARY KEY,
        activity_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        sample_quantity INTEGER NOT NULL,
        storage_location TEXT NOT NULL,
        archive_date TEXT NOT NULL,
        destroy_deadline TEXT NOT NULL,
        destroyed_at TEXT,
        status TEXT NOT NULL DEFAULT 'ARCHIVED',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (activity_id) REFERENCES activities(id),
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        activity_id TEXT,
        sample_archive_id TEXT,
        complaint_type TEXT NOT NULL,
        complaint_date TEXT NOT NULL,
        complaint_content TEXT NOT NULL,
        complainant TEXT NOT NULL,
        contact_info TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        resolution TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (activity_id) REFERENCES activities(id),
        FOREIGN KEY (sample_archive_id) REFERENCES sample_archives(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS trace_reports (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL,
        activity_id TEXT,
        report_content TEXT NOT NULL,
        report_date TEXT NOT NULL,
        conclusion TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id),
        FOREIGN KEY (activity_id) REFERENCES activities(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        request_id TEXT,
        old_status TEXT,
        new_status TEXT,
        operator TEXT,
        details TEXT,
        created_at TEXT NOT NULL
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_activities_store ON activities(store_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_batches_activity ON batches(activity_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_samples_activity ON sample_archives(activity_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_samples_status ON sample_archives(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_complaints_activity ON complaints(activity_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_logs_request ON operation_logs(request_id)`);
      
      resolve();
    }, reject);
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
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
  db,
  initTables,
  run,
  get,
  all
};
