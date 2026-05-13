const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { status, exception_type, responsible_person } = req.query;
  let query = 'SELECT * FROM exceptions WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (exception_type) {
    query += ' AND exception_type = ?';
    params.push(exception_type);
  }
  if (responsible_person) {
    query += ' AND responsible_person LIKE ?';
    params.push(`%${responsible_person}%`);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/stats', (req, res) => {
  db.serialize(() => {
    db.get('SELECT COUNT(*) as total FROM exceptions', (err1, total) => {
      db.get('SELECT COUNT(*) as pending FROM exceptions WHERE status = "pending"', (err2, pending) => {
        db.get('SELECT COUNT(*) as resolved FROM exceptions WHERE status = "resolved"', (err3, resolved) => {
          db.all(
            'SELECT exception_type, COUNT(*) as count FROM exceptions GROUP BY exception_type',
            (err4, byType) => {
              if (err1 || err2 || err3 || err4) {
                res.status(500).json({ error: '获取统计数据失败' });
              } else {
                res.json({
                  total: total.total,
                  pending: pending.pending,
                  resolved: resolved.resolved,
                  by_type: byType
                });
              }
            }
          );
        });
      });
    });
  });
});

router.put('/:id', (req, res) => {
  const { status, operator } = req.body;
  db.run(
    'UPDATE exceptions SET status = ? WHERE id = ?',
    [status, req.params.id],
    (err) => {
      if (err) res.status(500).json({ error: err.message });
      else {
        db.get('SELECT * FROM exceptions WHERE id = ?', [req.params.id], (err, row) => {
          if (err) res.status(500).json({ error: err.message });
          else res.json(row);
        });
      }
    }
  );
});

module.exports = router;
