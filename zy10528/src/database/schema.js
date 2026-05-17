const initSchema = (db) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS appeals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appeal_no TEXT UNIQUE NOT NULL,
        employee_id TEXT NOT NULL,
        employee_name TEXT,
        data_scope TEXT NOT NULL,
        revoke_reason TEXT NOT NULL,
        appeal_material TEXT,
        current_status TEXT NOT NULL DEFAULT 'PENDING',
        temp_restore_id INTEGER,
        conclusion TEXT,
        handler_id TEXT,
        handler_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) reject(err);
      });

      db.run(`CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appeal_id INTEGER NOT NULL,
        appeal_no TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        action_type TEXT NOT NULL,
        operator_id TEXT,
        operator_name TEXT,
        remark TEXT,
        basis TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appeal_id) REFERENCES appeals(id)
      )`, (err) => {
        if (err) reject(err);
      });

      db.run(`CREATE TABLE IF NOT EXISTS temp_restore (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appeal_id INTEGER NOT NULL,
        appeal_no TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        data_scope TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        is_expired INTEGER DEFAULT 0,
        operator_id TEXT,
        operator_name TEXT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appeal_id) REFERENCES appeals(id)
      )`, (err) => {
        if (err) reject(err);
      });

      db.run(`CREATE TABLE IF NOT EXISTS exception_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appeal_id INTEGER,
        appeal_no TEXT,
        operation_type TEXT NOT NULL,
        original_input TEXT,
        error_message TEXT,
        processing_basis TEXT,
        final_conclusion TEXT,
        handler_id TEXT,
        is_resolved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME
      )`, (err) => {
        if (err) reject(err);
      });

      db.run(`CREATE INDEX IF NOT EXISTS idx_appeals_employee ON appeals(employee_id)`, (err) => {
        if (err) reject(err);
      });

      db.run(`CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(current_status)`, (err) => {
        if (err) reject(err);
      });

      db.run(`CREATE INDEX IF NOT EXISTS idx_status_history_appeal ON status_history(appeal_id)`, (err) => {
        if (err) reject(err);
      });

      db.run(`CREATE INDEX IF NOT EXISTS idx_temp_restore_expired ON temp_restore(is_expired, end_time)`, (err) => {
        if (err) reject(err);
      });

      resolve();
    });
  });
};

module.exports = { initSchema };
