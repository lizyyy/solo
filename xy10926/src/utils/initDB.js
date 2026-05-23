const db = require('./database');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      room_count INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cleaning_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      task_date DATE NOT NULL,
      cleaner_name TEXT,
      status TEXT DEFAULT 'pending',
      assigned_at DATETIME,
      started_at DATETIME,
      completed_at DATETIME,
      accepted_at DATETIME,
      rejected_at DATETIME,
      rework_count INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS check_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_required INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS task_check_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      check_item_id INTEGER NOT NULL,
      is_passed INTEGER DEFAULT 0,
      checked_by TEXT,
      checked_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES cleaning_tasks(id),
      FOREIGN KEY (check_item_id) REFERENCES check_items(id),
      UNIQUE(task_id, check_item_id)
    );

    CREATE TABLE IF NOT EXISTS photo_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      task_check_item_id INTEGER,
      photo_path TEXT NOT NULL,
      photo_type TEXT NOT NULL,
      uploaded_by TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (task_id) REFERENCES cleaning_tasks(id),
      FOREIGN KEY (task_check_item_id) REFERENCES task_check_items(id)
    );

    CREATE TABLE IF NOT EXISTS complaint_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      property_id INTEGER,
      complaint_date DATE NOT NULL,
      complainant TEXT,
      category TEXT,
      description TEXT NOT NULL,
      related_check_items TEXT,
      status TEXT DEFAULT 'open',
      handled_by TEXT,
      handled_at DATETIME,
      resolution TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES cleaning_tasks(id),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS acceptance_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      report_number TEXT UNIQUE NOT NULL,
      inspector_name TEXT,
      inspected_at DATETIME,
      total_items INTEGER DEFAULT 0,
      passed_items INTEGER DEFAULT 0,
      failed_items INTEGER DEFAULT 0,
      overall_result TEXT,
      export_path TEXT,
      exported_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES cleaning_tasks(id)
    );

    CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_endpoint TEXT,
      request_method TEXT,
      raw_input TEXT,
      error_message TEXT,
      error_stack TEXT,
      handling_result TEXT,
      handled_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rework_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      rework_number INTEGER NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      reason TEXT,
      triggered_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES cleaning_tasks(id)
    );
  `);

  console.log('数据库初始化完成');
}

module.exports = initDatabase;
