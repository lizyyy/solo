const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { getAthleteWithDetails } = require('../services/qualificationService');

router.post('/', (req, res) => {
  const { name, id_card, phone, email, group_id } = req.body;
  db.run(
    'INSERT INTO athletes (name, id_card, phone, email, group_id) VALUES (?, ?, ?, ?, ?)',
    [name, id_card, phone, email, group_id],
    function(err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, name, id_card, phone, email, group_id });
    }
  );
});

router.get('/', (req, res) => {
  db.all('SELECT * FROM athletes ORDER BY registration_time DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', async (req, res) => {
  try {
    const athlete = await getAthleteWithDetails(req.params.id);
    if (!athlete) {
      return res.status(404).json({ error: '选手不存在' });
    }
    res.json(athlete);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/documents', (req, res) => {
  const { doc_type, doc_number, is_valid } = req.body;
  const athleteId = req.params.id;
  
  db.run(
    'INSERT OR REPLACE INTO documents (athlete_id, doc_type, doc_number, is_valid, verified_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [athleteId, doc_type, doc_number, is_valid ? 1 : 0],
    function(err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({ id: this.lastID, athlete_id: athleteId, doc_type, doc_number, is_valid });
    }
  );
});

router.get('/:id/documents', (req, res) => {
  db.all('SELECT * FROM documents WHERE athlete_id = ?', [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;
