const express = require('express');
const router = express.Router();
const { detectAllConflicts, detectConflictsForSchedule } = require('../utils/conflictDetector');

router.get('/', async (req, res) => {
  try {
    const result = await detectAllConflicts();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/schedule/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const result = await detectConflictsForSchedule(scheduleId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
