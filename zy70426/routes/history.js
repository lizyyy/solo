const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.get('/', (req, res) => {
  const { record_id, operator } = req.query;
  
  let query = 'SELECT * FROM process_history WHERE 1=1';
  let params = [];

  if (record_id) {
    query += ' AND record_id = ?';
    params.push(record_id);
  }
  if (operator) {
    query += ' AND operator = ?';
    params.push(operator);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    rows.forEach(row => {
      if (row.receipt_data) {
        row.receipt_data = JSON.parse(row.receipt_data);
      }
    });
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { record_id, action, operator, operator_department, before_status, after_status, remark, receipt_data } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO process_history (id, record_id, action, operator, operator_department, before_status, after_status, remark, receipt_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, record_id, action, operator, operator_department, before_status, after_status, remark, JSON.stringify(receipt_data), now],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id,
        record_id,
        action,
        operator,
        created_at: now
      });
    }
  );
});

router.get('/summaries', (req, res) => {
  const { record_id, created_by } = req.query;
  
  let query = 'SELECT * FROM material_summaries WHERE 1=1';
  let params = [];

  if (record_id) {
    query += ' AND record_id = ?';
    params.push(record_id);
  }
  if (created_by) {
    query += ' AND created_by = ?';
    params.push(created_by);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/summaries', (req, res) => {
  const { record_id, summary_type, content, created_by } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO material_summaries (id, record_id, summary_type, content, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, record_id, summary_type, content, created_by, now],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id,
        record_id,
        summary_type,
        content,
        created_by,
        created_at: now
      });
    }
  );
});

module.exports = router;
