const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { event_type, status, limit } = req.query;
  let query = 'SELECT * FROM timeline WHERE 1=1';
  const params = [];
  
  if (event_type) {
    query += ' AND event_type = ?';
    params.push(event_type);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  if (limit) {
    query += ' LIMIT ?';
    params.push(parseInt(limit));
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const result = rows.map(row => ({
      ...row,
      event_data: JSON.parse(row.event_data)
    }));
    
    res.json(result);
  });
});

router.get('/stats', (req, res) => {
  const query = `
    SELECT 
      status,
      COUNT(*) as count
    FROM timeline
    GROUP BY status
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const stats = {
      success: 0,
      failed: 0,
      blocked: 0,
      manual: 0
    };
    
    rows.forEach(row => {
      stats[row.status] = row.count;
    });
    
    res.json(stats);
  });
});

module.exports = router;