const express = require('express');
const router = express.Router();
const service = require('../services/pointsService');

router.get('/:memberId', (req, res) => {
  const { limit = 100 } = req.query;
  const ledger = service.getLedger(req.params.memberId, parseInt(limit));
  
  res.json({
    success: true,
    data: {
      memberId: req.params.memberId,
      totalRecords: ledger.length,
      records: ledger
    }
  });
});

module.exports = router;
