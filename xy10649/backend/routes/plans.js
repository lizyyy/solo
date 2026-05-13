const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { plan_name, status, responsible_person } = req.query;
  let sql = 'SELECT * FROM activity_plans WHERE 1=1';
  const params = [];

  if (plan_name) {
    sql += ' AND plan_name LIKE ?';
    params.push(`%${plan_name}%`);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (responsible_person) {
    sql += ' AND responsible_person LIKE ?';
    params.push(`%${responsible_person}%`);
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
  db.get('SELECT * FROM activity_plans WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: row });
  });
});

router.get('/:id/history', (req, res) => {
  db.all(
    'SELECT * FROM activity_plans_history WHERE plan_id = ? ORDER BY created_at DESC',
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ data: rows });
    }
  );
});

router.post('/', (req, res) => {
  const { plan_name, start_date, end_date, gift_type, total_quantity, budget, responsible_person, status, remarks } = req.body;
  const sql = `INSERT INTO activity_plans 
    (plan_name, start_date, end_date, gift_type, total_quantity, budget, responsible_person, status, remarks) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [plan_name, start_date, end_date, gift_type, total_quantity, budget, responsible_person, status || 'draft', remarks], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const afterData = JSON.stringify(req.body);
    db.run(
      'INSERT INTO activity_plans_history (plan_id, before_data, after_data, operator, operation_type) VALUES (?, ?, ?, ?, ?)',
      [this.lastID, null, afterData, 'system', 'create']
    );
    
    res.json({ id: this.lastID, message: '创建成功' });
  });
});

router.put('/:id', (req, res) => {
  db.get('SELECT * FROM activity_plans WHERE id = ?', [req.params.id], (err, before) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const { plan_name, start_date, end_date, gift_type, total_quantity, budget, responsible_person, status, remarks } = req.body;
    const sql = `UPDATE activity_plans SET 
      plan_name = ?, start_date = ?, end_date = ?, gift_type = ?, total_quantity = ?, budget = ?, responsible_person = ?, status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?`;
    
    db.run(sql, [plan_name, start_date, end_date, gift_type, total_quantity, budget, responsible_person, status, remarks, req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const beforeData = JSON.stringify(before);
      const afterData = JSON.stringify(req.body);
      db.run(
        'INSERT INTO activity_plans_history (plan_id, before_data, after_data, operator, operation_type) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, beforeData, afterData, 'system', 'update']
      );
      
      res.json({ message: '更新成功' });
    });
  });
});

router.delete('/:id', (req, res) => {
  db.get('SELECT * FROM activity_plans WHERE id = ?', [req.params.id], (err, before) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    db.run('DELETE FROM activity_plans WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const beforeData = JSON.stringify(before);
      db.run(
        'INSERT INTO activity_plans_history (plan_id, before_data, after_data, operator, operation_type) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, beforeData, null, 'system', 'delete']
      );
      
      res.json({ message: '删除成功' });
    });
  });
});

module.exports = router;
