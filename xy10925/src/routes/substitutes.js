const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { promoteSubstitute, checkGroupCapacity } = require('../services/qualificationService');

router.post('/', (req, res) => {
  const { athlete_id, group_id, priority } = req.body;
  db.run(
    'INSERT INTO substitutes (athlete_id, group_id, priority) VALUES (?, ?, ?)',
    [athlete_id, group_id, priority || 1],
    function(err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, athlete_id, group_id, priority });
    }
  );
});

router.get('/', (req, res) => {
  db.all('SELECT * FROM substitutes ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/promote/:groupId', async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const capacity = await checkGroupCapacity(groupId);
    if (!capacity.valid) {
      return res.status(400).json({ 
        error: '组别已满，无法递补',
        capacity: capacity
      });
    }

    const athleteId = await promoteSubstitute(groupId);
    if (!athleteId) {
      return res.status(404).json({ error: '没有可递补的替补选手' });
    }
    res.json({ success: true, promoted_athlete_id: athleteId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
