const db = require('../config/database');

const createEmployee = (req, res) => {
  const { employee_no, name, department, phone, email } = req.body;

  if (!employee_no || !name) {
    return res.status(400).json({ code: 400, message: '工号和姓名不能为空' });
  }

  db.get('SELECT * FROM employees WHERE employee_no = ?', [employee_no], (err, existing) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (existing) {
      return res.status(400).json({ code: 400, message: '工号已存在' });
    }

    const stmt = db.prepare(`INSERT INTO employees 
      (employee_no, name, department, phone, email, status, updated_at) 
      VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)`);
    
    stmt.run(employee_no, name, department, phone, email, function(err) {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      db.get('SELECT * FROM employees WHERE id = ?', [this.lastID], (err, employee) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
        }
        res.json({
          code: 200,
          message: '被访人创建成功',
          data: employee
        });
      });
    });
    stmt.finalize();
  });
};

const getEmployees = (req, res) => {
  const { status, department, keyword, page = 1, pageSize = 10 } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = 'SELECT * FROM employees WHERE 1=1';
  let params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (department) {
    query += ' AND department = ?';
    params.push(department);
  }
  
  if (keyword) {
    query += ' AND (name LIKE ? OR employee_no LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.all(query, params, (err, employees) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    let countQuery = 'SELECT COUNT(*) as total FROM employees WHERE 1=1';
    let countParams = params.slice(0, -2);
    
    db.get(countQuery, countParams, (err, result) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      res.json({
        code: 200,
        message: '获取成功',
        data: {
          list: employees,
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total: result.total
          }
        }
      });
    });
  });
};

const getEmployeeById = (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM employees WHERE id = ?', [id], (err, employee) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!employee) {
      return res.status(404).json({ code: 404, message: '被访人不存在' });
    }

    res.json({
      code: 200,
      message: '获取成功',
      data: employee
    });
  });
};

const updateEmployee = (req, res) => {
  const { id } = req.params;
  const { name, department, phone, email, status } = req.body;

  db.get('SELECT * FROM employees WHERE id = ?', [id], (err, employee) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!employee) {
      return res.status(404).json({ code: 404, message: '被访人不存在' });
    }

    const stmt = db.prepare(`UPDATE employees SET 
      name = COALESCE(?, name),
      department = COALESCE(?, department),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`);
    
    stmt.run(name, department, phone, email, status, id, (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      db.get('SELECT * FROM employees WHERE id = ?', [id], (err, updatedEmployee) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
        }
        res.json({
          code: 200,
          message: '更新成功',
          data: updatedEmployee
        });
      });
    });
    stmt.finalize();
  });
};

const deleteEmployee = (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM employees WHERE id = ?', [id], (err, employee) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!employee) {
      return res.status(404).json({ code: 404, message: '被访人不存在' });
    }

    db.run('DELETE FROM employees WHERE id = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      res.json({
        code: 200,
        message: '删除成功'
      });
    });
  });
};

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee
};
