const express = require('express');
const router = express.Router();
const InspectionService = require('../services/InspectionService');

router.post('/', async (req, res) => {
  try {
    const result = await InspectionService.inspect(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/arrival-note/:arrivalNoteId', async (req, res) => {
  try {
    const results = await InspectionService.findByArrivalNote(req.params.arrivalNoteId);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
