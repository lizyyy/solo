const express = require('express');
const router = express.Router();

const {
  searchClaimsHandler,
  getClaimHandler,
  processClaimHandler,
  batchProcessHandler,
  exportClaimsHandler,
  getClaimLogsHandler
} = require('../controllers/claimController');

router.get('/', searchClaimsHandler);
router.get('/export', exportClaimsHandler);
router.get('/:id', getClaimHandler);
router.post('/:id/process', processClaimHandler);
router.get('/:id/logs', getClaimLogsHandler);
router.post('/batch-process', batchProcessHandler);

module.exports = router;
