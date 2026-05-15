const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.post('/', (req, res) => {
  const { data_source_id } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO crawl_batches (id, data_source_id, started_at, status) VALUES (?, ?, ?, ?)',
    [id, data_source_id, now, 'running'],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id, data_source_id, started_at: now, status: 'running' });
    }
  );
});

router.get('/', (req, res) => {
  const { data_source_id, status, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM crawl_batches';
  const params = [];
  const conditions = [];

  if (data_source_id) {
    conditions.push('data_source_id = ?');
    params.push(data_source_id);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
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
  db.get('SELECT * FROM crawl_batches WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '抓取批次不存在' });
    }
    res.json(row);
  });
});

router.put('/:id/status', (req, res) => {
  const { status, success_count, failed_count, error_message } = req.body;
  const now = new Date().toISOString();

  let query = 'UPDATE crawl_batches SET status = ?';
  const params = [status];

  if (success_count !== undefined) {
    query += ', success_count = ?';
    params.push(success_count);
  }
  if (failed_count !== undefined) {
    query += ', failed_count = ?';
    params.push(failed_count);
  }
  if (status === 'completed' || status === 'failed') {
    query += ', completed_at = ?';
    params.push(now);
  }
  if (error_message) {
    query += ', error_message = ?';
    params.push(error_message);
  }

  query += ' WHERE id = ?';
  params.push(req.params.id);

  db.run(query, params, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '抓取批次不存在' });
    }
    res.json({ id: req.params.id, status, updated_at: now });
  });
});

module.exports = router;
