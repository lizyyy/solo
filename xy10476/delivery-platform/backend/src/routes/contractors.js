const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM contractors WHERE 1=1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY id';

  const contractors = db.all(sql, params);
  res.json({ code: 0, data: contractors });
});

router.post('/', (req, res) => {
  const { name, contact_person, phone, category } = req.body;
  
  if (!name) {
    return res.status(400).json({ code: 1, message: '施工方名称不能为空' });
  }

  const result = db.prepare(
    'INSERT INTO contractors (name, contact_person, phone, category) VALUES (?, ?, ?, ?)'
  ).run(name, contact_person, phone, category);

  res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

router.put('/:id', (req, res) => {
  const { name, contact_person, phone, category } = req.body;
  
  const contractor = db.get('SELECT * FROM contractors WHERE id = ?', [req.params.id]);
  if (!contractor) {
    return res.status(404).json({ code: 1, message: '施工方不存在' });
  }

  db.prepare(
    'UPDATE contractors SET name = ?, contact_person = ?, phone = ?, category = ? WHERE id = ?'
  ).run(name, contact_person, phone, category, req.params.id);

  res.json({ code: 0, message: '更新成功' });
});

router.delete('/:id', (req, res) => {
  const orders = db.all('SELECT id FROM work_orders WHERE contractor_id = ?', [req.params.id]);
  
  if (orders.length > 0) {
    return res.status(400).json({ code: 1, message: '该施工方下存在派单记录，无法删除' });
  }

  db.run('DELETE FROM contractors WHERE id = ?', [req.params.id]);
  res.json({ code: 0, message: '删除成功' });
});

module.exports = router;
