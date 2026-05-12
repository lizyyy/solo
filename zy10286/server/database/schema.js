const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');

function createTables(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        course_name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        id_card TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS student_accounts (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        account_type TEXT NOT NULL,
        account_identifier TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS class_enrollments (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        enrollment_date TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        refund_date TEXT,
        transfer_from_id TEXT,
        transfer_to_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (class_id) REFERENCES classes(id),
        FOREIGN KEY (student_id) REFERENCES students(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS live_sessions (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        title TEXT NOT NULL,
        session_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        replay_url TEXT,
        replay_expiry_date TEXT,
        status TEXT DEFAULT 'scheduled',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (class_id) REFERENCES classes(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS replay_permissions (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        enrollment_id TEXT NOT NULL,
        granted_at TEXT NOT NULL,
        expires_at TEXT,
        revoked_at TEXT,
        revoke_reason TEXT,
        status TEXT DEFAULT 'active',
        source TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (session_id) REFERENCES live_sessions(id),
        FOREIGN KEY (class_id) REFERENCES classes(id),
        FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS access_logs (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        account_identifier TEXT,
        session_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        access_time TEXT DEFAULT CURRENT_TIMESTAMP,
        access_type TEXT,
        was_allowed INTEGER DEFAULT 1,
        deny_reason TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS business_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        description TEXT NOT NULL,
        previous_state TEXT,
        new_state TEXT,
        operator TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS permission_anomalies (
        id TEXT PRIMARY KEY,
        anomaly_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        student_id TEXT,
        session_id TEXT,
        class_id TEXT,
        description TEXT NOT NULL,
        detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT,
        resolver TEXT,
        status TEXT DEFAULT 'open',
        notes TEXT
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_enrollments_student ON class_enrollments(student_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_enrollments_class ON class_enrollments(class_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_permissions_student ON replay_permissions(student_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_permissions_session ON replay_permissions(session_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_logs_student ON access_logs(student_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_anomalies_status ON permission_anomalies(status)`);
    }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    createTables(db)
      .then(() => {
        console.log('Database tables created/verified');
        resolve(db);
      })
      .catch((err) => {
        console.error('Error creating tables:', err);
        reject(err);
      });
  });
}

module.exports = { initDatabase, dbPath };
