const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.post('/', (req, res) => {
  const { name, type, url, config } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO data_sources (id, name, type, url, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name, type, url, JSON.stringify(config || {}), now, now],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id, name, type, url, config, created_at: now });
    }
  );
});

router.get('/', (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM data_sources';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM data_sources WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '数据源不存在' });
    }
    res.json(row);
  });
});

router.put('/:id', (req, res) => {
  const { name, type, url, status, config } = req.body;
  const now = new Date().toISOString();

  db.run(
    'UPDATE data_sources SET name = ?, type = ?, url = ?, status = ?, config = ?, updated_at = ? WHERE id = ?',
    [name, type, url, status || 'active', JSON.stringify(config || {}), now, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '数据源不存在' });
      }
      res.json({ id: req.params.id, updated_at: now });
    }
  );
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM data_sources WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '数据源不存在' });
    }
    res.json({ message: '删除成功' });
  });
});

module.exports = router;
