const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.post('/', (req, res) => {
  const { data_source_id, crawl_batch_id, content, metadata, last_modified_at, fingerprint } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO snippets (id, data_source_id, crawl_batch_id, content, metadata, last_modified_at, fingerprint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, data_source_id, crawl_batch_id, content, JSON.stringify(metadata || {}), last_modified_at || now, fingerprint, now, now],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id, data_source_id, content, created_at: now });
    }
  );
});

router.get('/', (req, res) => {
  const { data_source_id, is_expired, limit = 100, offset = 0 } = req.query;
  let query = 'SELECT * FROM snippets';
  const params = [];
  const conditions = [];

  if (data_source_id) {
    conditions.push('data_source_id = ?');
    params.push(data_source_id);
  }
  if (is_expired !== undefined) {
    conditions.push('is_expired = ?');
    params.push(is_expired === 'true' ? 1 : 0);
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
  db.get('SELECT * FROM snippets WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '引用片段不存在' });
    }
    res.json(row);
  });
});

router.post('/:id/references', (req, res) => {
  const { question_id, answer_id, reference_context } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO snippet_references (id, snippet_id, question_id, answer_id, reference_context, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, req.params.id, question_id, answer_id, reference_context, now],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id, snippet_id: req.params.id, question_id, answer_id });
    }
  );
});

router.get('/:id/references', (req, res) => {
  db.all('SELECT * FROM snippet_references WHERE snippet_id = ? ORDER BY created_at DESC', [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;
