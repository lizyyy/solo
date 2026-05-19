const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.post('/', (req, res) => {
  const { type, level, message, related_id, related_type } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO alerts (id, type, level, message, related_id, related_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, type, level, message, related_id, related_type, now],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id, type, level, message, created_at: now });
    }
  );
});

router.get('/', (req, res) => {
  const { level, is_resolved, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM alerts';
  const params = [];
  const conditions = [];

  if (level) {
    conditions.push('level = ?');
    params.push(level);
  }
  if (is_resolved !== undefined) {
    conditions.push('is_resolved = ?');
    params.push(is_resolved === 'true' ? 1 : 0);
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

router.put('/:id/resolve', (req, res) => {
  const { resolved_by, resolve_note } = req.body;
  const now = new Date().toISOString();

  db.run(
    'UPDATE alerts SET is_resolved = 1, resolved_by = ?, resolved_at = ?, resolve_note = ? WHERE id = ?',
    [resolved_by, now, resolve_note, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '告警不存在' });
      }
      res.json({ id: req.params.id, is_resolved: true, resolved_at: now });
    }
  );
});

module.exports = router;
