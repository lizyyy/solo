const db = require('../config/database');

const initTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        employee_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        department TEXT,
        position TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS certificate_types (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        valid_years INTEGER NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        certificate_type_id TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        passing_score INTEGER DEFAULT 60,
        FOREIGN KEY (certificate_type_id) REFERENCES certificate_types(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS course_scores (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        exam_date DATE NOT NULL,
        is_passed BOOLEAN NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (course_id) REFERENCES courses(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, course_id, exam_date)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS retake_records (
        id TEXT PRIMARY KEY,
        original_score_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        retake_count INTEGER DEFAULT 1,
        score INTEGER,
        retake_date DATE,
        is_passed BOOLEAN,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (original_score_id) REFERENCES course_scores(id),
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (course_id) REFERENCES courses(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS position_requirements (
        id TEXT PRIMARY KEY,
        position TEXT NOT NULL,
        certificate_type_id TEXT NOT NULL,
        is_required BOOLEAN DEFAULT true,
        FOREIGN KEY (certificate_type_id) REFERENCES certificate_types(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(position, certificate_type_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS employee_certificates (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        certificate_type_id TEXT NOT NULL,
        issue_date DATE NOT NULL,
        expiry_date DATE NOT NULL,
        status TEXT DEFAULT 'valid',
        idempotency_key TEXT UNIQUE,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (certificate_type_id) REFERENCES certificate_types(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS renewal_checklists (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        certificate_type_id TEXT NOT NULL,
        employee_certificate_id TEXT,
        checklist_date DATE NOT NULL,
        status TEXT DEFAULT 'pending',
        days_until_expiry INTEGER,
        is_qualified BOOLEAN,
        qualification_details TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (certificate_type_id) REFERENCES certificate_types(id),
        FOREIGN KEY (employee_certificate_id) REFERENCES employee_certificates(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS processing_exceptions (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        raw_input TEXT NOT NULL,
        error_message TEXT NOT NULL,
        processing_result TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        handled_by TEXT,
        handled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS manual_corrections (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT NOT NULL,
        reason TEXT NOT NULL,
        operator TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

module.exports = initTables;
