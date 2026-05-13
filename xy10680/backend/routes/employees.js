const express = require('express');
const router = express.Router();
const db = require('../database');
const { checkIdempotency } = require('../middleware/idempotency');
const { addTimelineEvent } = require('../utils/timeline');

router.get('/', (req, res) => {
  const { department, status, size } = req.query;
  let query = 'SELECT * FROM employees WHERE 1=1';
  const params = [];
  
  if (department) {
    query += ' AND department = ?';
    params.push(department);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (size) {
    query += ' AND size = ?';
    params.push(size);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/', checkIdempotency('employee'), (req, res) => {
  const { employee_id, name, department, size } = req.body;
  
  db.run(
    'INSERT INTO employees (employee_id, name, department, size) VALUES (?, ?, ?, ?)',
    [employee_id, name, department, size],
    async function(err) {
      if (err) {
        await addTimelineEvent('employee', req.body, 'failed', `员工创建失败: ${err.message}`);
        res.status(500).json({ error: err.message });
        return;
      }
      
      await addTimelineEvent('employee', { id: this.lastID, ...req.body }, 'success', `员工 ${name} 创建成功`);
      res.json({ id: this.lastID, employee_id, name, department, size });
    }
  );
});

router.put('/:id', (req, res) => {
  const { name, department, size, status } = req.body;
  const { id } = req.params;
  
  db.run(
    'UPDATE employees SET name = ?, department = ?, size = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, department, size, status, id],
    async function(err) {
      if (err) {
        await addTimelineEvent('employee_update', { id, ...req.body }, 'failed', `员工更新失败: ${err.message}`);
        res.status(500).json({ error: err.message });
        return;
      }
      
      await addTimelineEvent('employee_update', { id, ...req.body }, 'success', `员工 ${name} 更新成功`);
      res.json({ updated: this.changes });
    }
  );
});

module.exports = router;