const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { employee_name, department, status } = req.query;
  let sql = 'SELECT * FROM employee_claims WHERE 1=1';
  const params = [];

  if (employee_name) {
    sql += ' AND employee_name LIKE ?';
    params.push(`%${employee_name}%`);
  }
  if (department) {
    sql += ' AND department = ?';
    params.push(department);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM employee_claims WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: row });
  });
});

router.post('/', (req, res) => {
  const { employee_name, department, gift_type, quantity, claim_date, purpose, approver, status, remarks } = req.body;
  const sql = `INSERT INTO employee_claims 
    (employee_name, department, gift_type, quantity, claim_date, purpose, approver, status, remarks) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [employee_name, department, gift_type, quantity, claim_date, purpose, approver, status || 'pending', remarks], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: '创建成功' });
  });
});

router.put('/:id', (req, res) => {
  const { employee_name, department, gift_type, quantity, claim_date, purpose, approver, status, remarks } = req.body;
  const sql = `UPDATE employee_claims SET 
    employee_name = ?, department = ?, gift_type = ?, quantity = ?, claim_date = ?, purpose = ?, approver = ?, status = ?, remarks = ?
    WHERE id = ?`;
  
  db.run(sql, [employee_name, department, gift_type, quantity, claim_date, purpose, approver, status, remarks, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: '更新成功' });
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM employee_claims WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: '删除成功' });
  });
});

module.exports = router;
