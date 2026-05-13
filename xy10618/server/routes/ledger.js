const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/', (req, res) => {
  db.all('SELECT * FROM balance_ledger ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/member/:memberId', (req, res) => {
  db.all('SELECT * FROM balance_ledger WHERE member_id = ? ORDER BY created_at DESC', [req.params.memberId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;
