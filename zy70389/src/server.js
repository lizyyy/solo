const express = require('express');
const db = require('./db');
const syncService = require('./syncService');

const app = express();
app.use(express.json());

const seedData = () => {
  const roleCount = db.prepare(`SELECT COUNT(*) as count FROM roles`).get().count;
  if (roleCount === 0) {
    db.prepare(`INSERT INTO roles (id, name, code, is_sensitive) VALUES (?, ?, ?, ?)`).run('r1', '普通员工', 'employee', 0);
    db.prepare(`INSERT INTO roles (id, name, code, is_sensitive) VALUES (?, ?, ?, ?)`).run('r2', '部门经理', 'manager', 0);
    db.prepare(`INSERT INTO roles (id, name, code, is_sensitive) VALUES (?, ?, ?, ?)`).run('r3', '财务审批', 'finance_approver', 1);
    db.prepare(`INSERT INTO roles (id, name, code, is_sensitive) VALUES (?, ?, ?, ?)`).run('r4', '系统管理员', 'admin', 1);
  }
  
  const deptCount = db.prepare(`SELECT COUNT(*) as count FROM departments`).get().count;
  if (deptCount === 0) {
    db.prepare(`INSERT INTO departments (id, name, code, parent_id) VALUES (?, ?, ?, ?)`).run('dept_root', '总公司', 'ROOT', null);
    db.prepare(`INSERT INTO departments (id, name, code, parent_id) VALUES (?, ?, ?, ?)`).run('dept_tech', '技术部', 'TECH', 'dept_root');
    db.prepare(`INSERT INTO departments (id, name, code, parent_id) VALUES (?, ?, ?, ?)`).run('dept_ops', '运维部', 'OPS', 'dept_root');
    db.prepare(`INSERT INTO departments (id, name, code, parent_id) VALUES (?, ?, ?, ?)`).run('dept_hr', '人力资源部', 'HR', 'dept_root');
  }
  
  const empCount = db.prepare(`SELECT COUNT(*) as count FROM employees`).get().count;
  if (empCount === 0) {
    db.prepare(`INSERT INTO employees (id, name, emp_no, department_id, position, status) VALUES (?, ?, ?, ?, ?, ?)`).run('emp_1001', '张三', 'E1001', 'dept_tech', '工程师', 'active');
    db.prepare(`INSERT INTO employees (id, name, emp_no, department_id, position, status) VALUES (?, ?, ?, ?, ?, ?)`).run('emp_1002', '李四', 'E1002', 'dept_ops', '运维主管', 'active');
    db.prepare(`INSERT INTO employees (id, name, emp_no, department_id, position, status) VALUES (?, ?, ?, ?, ?, ?)`).run('emp_1003', '王五', 'E1003', 'dept_hr', 'HR经理', 'active');
    
    db.prepare(`INSERT INTO employee_roles (employee_id, role_id) VALUES (?, ?)`).run('emp_1001', 'r1');
    db.prepare(`INSERT INTO employee_roles (employee_id, role_id) VALUES (?, ?)`).run('emp_1002', 'r2');
    db.prepare(`INSERT INTO employee_roles (employee_id, role_id) VALUES (?, ?)`).run('emp_1003', 'r3');
    db.prepare(`INSERT INTO employee_roles (employee_id, role_id) VALUES (?, ?)`).run('emp_1003', 'r4');
  }
};
seedData();

app.post('/api/org-sync/import', (req, res) => {
  try {
    const { source, departments, employees } = req.body;
    
    if (!source) {
      return res.status(400).json({ error: '缺少 source 参数' });
    }
    
    const batchId = syncService.createBatch(source);
    
    if (departments && Array.isArray(departments)) {
      for (const dept of departments) {
        syncService.createOrUpdateDepartment(dept, batchId);
      }
    }
    
    if (employees && Array.isArray(employees)) {
      syncService.processEmployeeChanges(employees, batchId);
    }
    
    const report = syncService.executeBatch(batchId);
    res.json({ batch_id: batchId, ...report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/org-sync/batches/:batchId/retry', (req, res) => {
  try {
    const { batchId } = req.params;
    const report = syncService.retryBatch(batchId);
    res.json({ batch_id: batchId, ...report });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/org-sync/batches', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const batches = syncService.listBatches(limit, offset);
    res.json({ batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/org-sync/batches/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;
    const report = syncService.getBatchReport(batchId);
    
    if (!report) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/departments', (req, res) => {
  const depts = db.prepare(`SELECT * FROM departments ORDER BY id`).all();
  res.json(depts);
});

app.get('/api/employees', (req, res) => {
  const emps = db.prepare(`SELECT * FROM employees ORDER BY id`).all();
  res.json(emps);
});

app.get('/api/employees/:id/history', (req, res) => {
  const history = db.prepare(`
    SELECT dh.*, d.name as dept_name, d.code as dept_code
    FROM department_history dh
    JOIN departments d ON dh.dept_id = d.id
    WHERE dh.employee_id = ?
    ORDER BY dh.start_date DESC
  `).all(req.params.id);
  res.json(history);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`组织架构同步 API 服务器运行在 http://localhost:${PORT}`);
});
