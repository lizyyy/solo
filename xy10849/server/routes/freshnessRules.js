const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.post('/', (req, res) => {
  const { name, description, rule_type, condition, action, priority } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO freshness_rules (id, name, description, rule_type, condition, action, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, description, rule_type, condition, action, priority || 0, now, now],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id, name, rule_type, created_at: now });
    }
  );
});

router.get('/', (req, res) => {
  const { rule_type, is_enabled, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM freshness_rules';
  const params = [];
  const conditions = [];

  if (rule_type) {
    conditions.push('rule_type = ?');
    params.push(rule_type);
  }
  if (is_enabled !== undefined) {
    conditions.push('is_enabled = ?');
    params.push(is_enabled === 'true' ? 1 : 0);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY priority DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.put('/:id/toggle', (req, res) => {
  const now = new Date().toISOString();

  db.run(
    'UPDATE freshness_rules SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?',
    [now, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '规则不存在' });
      }
      res.json({ id: req.params.id, updated_at: now });
    }
  );
});

module.exports = router;
