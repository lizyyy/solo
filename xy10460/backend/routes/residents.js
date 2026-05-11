const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  db.all('SELECT * FROM residents ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { name, phone, address } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ error: '姓名和手机号不能为空' });
  }

  db.run('INSERT INTO residents (name, phone, address) VALUES (?, ?, ?)',
    [name, phone, address || ''],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, name, phone, address: address || '', total_points: 0 });
    }
  );
});

router.put('/:id', (req, res) => {
  const { name, phone, address } = req.body;
  const id = req.params.id;

  db.run('UPDATE residents SET name = ?, phone = ?, address = ? WHERE id = ?',
    [name, phone, address, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: '更新成功' });
    }
  );
});

router.delete('/:id', (req, res) => {
  const id = req.params.id;

  db.get('SELECT COUNT(*) as count FROM delivery_records WHERE resident_id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (row.count > 0) {
      return res.status(400).json({ error: '该居民存在投递记录，无法删除' });
    }

    db.run('DELETE FROM residents WHERE id = ?', [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '删除成功' });
    });
  });
});

module.exports = router;
