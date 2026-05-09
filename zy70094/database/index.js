const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'pv_system.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功，路径:', dbPath);
  }
});

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        applicant_name TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        address TEXT NOT NULL,
        pv_capacity REAL NOT NULL,
        status TEXT DEFAULT 'SUBMITTED',
        submit_time TEXT NOT NULL,
        update_time TEXT NOT NULL,
        remark TEXT,
        version INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS surveys (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        scheduled_time TEXT,
        surveyor TEXT,
        survey_result TEXT,
        survey_time TEXT,
        status TEXT DEFAULT 'PENDING',
        create_time TEXT NOT NULL,
        update_time TEXT NOT NULL,
        remark TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (application_id) REFERENCES applications(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        node_type TEXT NOT NULL,
        approver TEXT,
        approval_result TEXT,
        approval_time TEXT,
        status TEXT DEFAULT 'PENDING',
        create_time TEXT NOT NULL,
        update_time TEXT NOT NULL,
        remark TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (application_id) REFERENCES applications(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS meter_tasks (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        task_type TEXT NOT NULL,
        install_address TEXT,
        meter_type TEXT,
        installer TEXT,
        install_time TEXT,
        status TEXT DEFAULT 'PENDING',
        create_time TEXT NOT NULL,
        update_time TEXT NOT NULL,
        remark TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (application_id) REFERENCES applications(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS supplements (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        missing_materials TEXT NOT NULL,
        submit_deadline TEXT,
        supplement_time TEXT,
        submitted_materials TEXT,
        status TEXT DEFAULT 'PENDING',
        create_time TEXT NOT NULL,
        update_time TEXT NOT NULL,
        remark TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (application_id) REFERENCES applications(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS grid_reports (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        report_content TEXT,
        grid_connection_time TEXT,
        operator TEXT,
        status TEXT DEFAULT 'PENDING',
        create_time TEXT NOT NULL,
        update_time TEXT NOT NULL,
        remark TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (application_id) REFERENCES applications(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        operator TEXT,
        before_state TEXT,
        after_state TEXT,
        remark TEXT,
        create_time TEXT NOT NULL
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_surveys_application ON surveys(application_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_approvals_application ON approvals(application_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_logs_application ON operation_logs(application_id)`);

      resolve();
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  db,
  initDatabase,
  runQuery,
  getQuery,
  allQuery
};
