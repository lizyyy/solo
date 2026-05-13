const db = require('../models/database');

const initDatabase = () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      budget_limit REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      employee_no TEXT NOT NULL UNIQUE,
      department_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )`,
    `CREATE TABLE IF NOT EXISTS overtime_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      overtime_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      hours REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      approver_id INTEGER,
      approved_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )`,
    `CREATE TABLE IF NOT EXISTS meal_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      order_date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      amount REAL NOT NULL,
      restaurant TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )`,
    `CREATE TABLE IF NOT EXISTS subsidy_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      condition_json TEXT NOT NULL,
      action TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS budget_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL,
      period TEXT NOT NULL,
      total_budget REAL NOT NULL,
      used_budget REAL DEFAULT 0,
      remaining_budget REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )`,
    `CREATE TABLE IF NOT EXISTS refund_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      reviewer_id INTEGER,
      review_comment TEXT,
      reviewed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES meal_orders(id),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )`,
    `CREATE TABLE IF NOT EXISTS refund_reversals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      refund_request_id INTEGER NOT NULL,
      operator_id INTEGER NOT NULL,
      operator_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      affected_records TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (refund_request_id) REFERENCES refund_requests(id)
    )`,
    `CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      operator_id INTEGER,
      operator_name TEXT,
      before_value TEXT,
      after_value TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS modification_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator_id INTEGER,
      operator_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  const createTables = () => {
    return new Promise((resolve, reject) => {
      let completed = 0;
      tables.forEach((sql, index) => {
        db.run(sql, (err) => {
          if (err) {
            console.error(`创建表 ${index} 失败:`, err.message);
            reject(err);
          } else {
            completed++;
            if (completed === tables.length) {
              console.log('所有表创建成功');
              resolve();
            }
          }
        });
      });
    });
  };

  const seedData = () => {
    return new Promise((resolve, reject) => {
      const departments = [
        { name: '技术部', code: 'TECH', budget_limit: 50000 },
        { name: '产品部', code: 'PROD', budget_limit: 30000 },
        { name: '运营部', code: 'OPS', budget_limit: 20000 }
      ];

      const employees = [
        { name: '张三', employee_no: 'E001', department_id: 1 },
        { name: '李四', employee_no: 'E002', department_id: 1 },
        { name: '王五', employee_no: 'E003', department_id: 2 },
        { name: '赵六', employee_no: 'E004', department_id: 3 },
        { name: '审核员', employee_no: 'ADMIN001', department_id: null }
      ];

      const rules = [
        {
          name: '加班时长限制',
          rule_type: 'overtime',
          condition_json: JSON.stringify({ minHours: 2 }),
          action: 'reject',
          priority: 1
        },
        {
          name: '单笔金额限制',
          rule_type: 'amount',
          condition_json: JSON.stringify({ maxAmount: 100 }),
          action: 'reject',
          priority: 2
        },
        {
          name: '月度预算检查',
          rule_type: 'budget',
          condition_json: JSON.stringify({ checkBudget: true }),
          action: 'pending',
          priority: 3
        }
      ];

      let completed = 0;
      const total = departments.length + employees.length + rules.length;

      departments.forEach(dept => {
        db.run('INSERT OR IGNORE INTO departments (name, code, budget_limit) VALUES (?, ?, ?)', 
          [dept.name, dept.code, dept.budget_limit], (err) => {
          if (err) console.error('插入部门失败:', err);
          completed++;
          if (completed === total) resolve();
        });
      });

      employees.forEach(emp => {
        db.run('INSERT OR IGNORE INTO employees (name, employee_no, department_id) VALUES (?, ?, ?)', 
          [emp.name, emp.employee_no, emp.department_id], (err) => {
          if (err) console.error('插入员工失败:', err);
          completed++;
          if (completed === total) resolve();
        });
      });

      rules.forEach(rule => {
        db.run('INSERT OR IGNORE INTO subsidy_rules (name, rule_type, condition_json, action, priority) VALUES (?, ?, ?, ?, ?)', 
          [rule.name, rule.rule_type, rule.condition_json, rule.action, rule.priority], (err) => {
          if (err) console.error('插入规则失败:', err);
          completed++;
          if (completed === total) resolve();
        });
      });
    });
  };

  createTables()
    .then(seedData)
    .then(() => {
      console.log('数据库初始化完成');
      process.exit(0);
    })
    .catch((err) => {
      console.error('数据库初始化失败:', err);
      process.exit(1);
    });
};

initDatabase();
