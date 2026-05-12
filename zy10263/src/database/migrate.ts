import { runAsync } from './connection';

const createTables = async () => {
  try {
    console.log('开始创建数据表...');

    await runAsync(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        employee_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        current_line_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS employee_skills (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
        created_at TEXT NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (skill_id) REFERENCES skills(id),
        UNIQUE(employee_id, skill_id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS production_lines (
        id TEXT PRIMARY KEY,
        line_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        required_skill_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (required_skill_id) REFERENCES skills(id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS line_swap_requests (
        id TEXT PRIMARY KEY,
        request_no TEXT UNIQUE NOT NULL,
        employee_id TEXT NOT NULL,
        from_line_id TEXT,
        to_line_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        skill_match INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (from_line_id) REFERENCES production_lines(id),
        FOREIGN KEY (to_line_id) REFERENCES production_lines(id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS work_hours (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        line_id TEXT NOT NULL,
        swap_request_id TEXT,
        date TEXT NOT NULL,
        hours REAL NOT NULL CHECK (hours > 0),
        confirmed_by TEXT,
        confirmed_at TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (line_id) REFERENCES production_lines(id),
        FOREIGN KEY (swap_request_id) REFERENCES line_swap_requests(id),
        UNIQUE(employee_id, line_id, date, swap_request_id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS absences (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        reason TEXT,
        hours REAL NOT NULL CHECK (hours > 0),
        approved_by TEXT,
        approved_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        UNIQUE(employee_id, date)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS performances (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        line_id TEXT NOT NULL,
        month TEXT NOT NULL,
        total_hours REAL NOT NULL DEFAULT 0,
        normal_hours REAL NOT NULL DEFAULT 0,
        overtime_hours REAL NOT NULL DEFAULT 0,
        absence_hours REAL NOT NULL DEFAULT 0,
        efficiency REAL,
        quality_rate REAL,
        calculated_at TEXT NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (line_id) REFERENCES production_lines(id),
        UNIQUE(employee_id, line_id, month)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS operation_history (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        before_data TEXT,
        after_data TEXT,
        remark TEXT,
        created_at TEXT NOT NULL
      )
    `);

    await runAsync(`CREATE INDEX IF NOT EXISTS idx_employee_skills_employee ON employee_skills(employee_id)`);
    await runAsync(`CREATE INDEX IF NOT EXISTS idx_line_swap_requests_employee ON line_swap_requests(employee_id)`);
    await runAsync(`CREATE INDEX IF NOT EXISTS idx_line_swap_requests_status ON line_swap_requests(status)`);
    await runAsync(`CREATE INDEX IF NOT EXISTS idx_work_hours_employee_date ON work_hours(employee_id, date)`);
    await runAsync(`CREATE INDEX IF NOT EXISTS idx_absences_employee_date ON absences(employee_id, date)`);
    await runAsync(`CREATE INDEX IF NOT EXISTS idx_performances_employee_month ON performances(employee_id, month)`);
    await runAsync(`CREATE INDEX IF NOT EXISTS idx_operation_history_entity ON operation_history(entity_type, entity_id)`);

    console.log('数据表创建完成！');
  } catch (error) {
    console.error('创建数据表失败:', error);
    throw error;
  }
};

createTables().then(() => process.exit(0)).catch(() => process.exit(1));
