const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { processCheckin, manualCorrect } = require('../services/qualificationService');

router.post('/', async (req, res) => {
  try {
    const { athlete_id, operator } = req.body;
    const result = await processCheckin(athlete_id, operator);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  db.all('SELECT * FROM checkin_events ORDER BY checkin_time DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/athlete/:athleteId', (req, res) => {
  db.all(
    'SELECT * FROM checkin_events WHERE athlete_id = ? ORDER BY checkin_time DESC',
    [req.params.athleteId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

router.post('/manual', async (req, res) => {
  try {
    const { athlete_id, new_status, changed_by, reason } = req.body;
    const result = await manualCorrect(athlete_id, new_status, changed_by, reason);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/status-history/:athleteId', (req, res) => {
  db.all(
    'SELECT * FROM status_history WHERE athlete_id = ? ORDER BY changed_at DESC',
    [req.params.athleteId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

module.exports = router;
