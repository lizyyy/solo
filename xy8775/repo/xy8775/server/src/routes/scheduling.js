const express = require('express');
const router = express.Router();
const { generateSchedule } = require('../utils/scheduler');

router.post('/generate', async (req, res) => {
  try {
    const { clearExisting } = req.body;
    const result = await generateSchedule({ clearExisting: clearExisting === true });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
