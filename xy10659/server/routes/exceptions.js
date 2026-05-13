const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status, exception_type } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = 'SELECT * FROM exceptions WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as total FROM exceptions WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
  }
  
  if (exception_type) {
    query += ' AND exception_type = ?';
    countQuery += ' AND exception_type = ?';
    params.push(exception_type);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  
  db.get(countQuery, params.slice(0, params.length - (status ? 1 : 0) - (exception_type ? 1 : 0)), (err, countResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.all(query, [...params, parseInt(pageSize), offset], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ data: rows, total: countResult.total });
    });
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM exceptions WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

router.put('/:id/resolve', (req, res) => {
  const { corrected_by, new_value } = req.body;
  const corrected_at = new Date().toISOString();
  
  db.run(
    'UPDATE exceptions SET status = ?, corrected_by = ?, corrected_at = ?, new_value = ? WHERE id = ?',
    ['resolved', corrected_by, corrected_at, new_value, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ updated: this.changes });
    }
  );
});

module.exports = router;
