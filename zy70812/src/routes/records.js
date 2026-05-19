const express = require('express');
const router = express.Router();
const {
  createRecord,
  processRecord,
  returnForRevision,
  handleSpecialCase,
  confirmAgent,
  lockBerth,
  confirmLoadingPlan,
  listRecords,
  getRecordDetail
} = require('../controllers/recordController');

router.post('/', createRecord);
router.get('/', listRecords);
router.get('/:id', getRecordDetail);
router.put('/:id/process', processRecord);
router.put('/:id/return', returnForRevision);
router.put('/:id/special-case', handleSpecialCase);
router.put('/:id/confirm-agent', confirmAgent);
router.put('/:id/lock-berth', lockBerth);
router.put('/:id/confirm-loading-plan', confirmLoadingPlan);

module.exports = router;
