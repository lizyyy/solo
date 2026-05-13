const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM technicians ORDER BY createdAt DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, phone, status, currentLocation, currentLat, currentLng, skills } = req.body;
  const id = uuidv4();
  const now = Date.now();

  db.run(
    'INSERT INTO technicians (id, name, phone, status, currentLocation, currentLat, currentLng, skills, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, phone, status || '空闲', currentLocation, currentLat, currentLng, JSON.stringify(skills || []), now],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id });
    }
  );
});

module.exports = router;
