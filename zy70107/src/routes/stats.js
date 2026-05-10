const express = require('express');
const router = express.Router();
const declarationService = require('../services/declarationService');

router.get('/', (req, res) => {
  try {
    const stats = declarationService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export', (req, res) => {
  try {
    const filters = {
      boat_id: req.query.boat_id,
      status: req.query.status,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };
    const data = declarationService.exportDeclarations(filters);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
