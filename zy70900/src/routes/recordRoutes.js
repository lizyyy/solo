const express = require('express');
const recordController = require('../controllers/recordController');

const router = express.Router();

router.post('/:id/process', recordController.processRecord);
router.post('/:id/return', recordController.returnRecord);
router.post('/:id/supplement', recordController.requestSupplement);

router.get('/', recordController.queryRecords);
router.get('/:id', recordController.getRecordDetail);
router.get('/:id/trace', recordController.getRecordTrace);
router.get('/operator/:operator/logs', recordController.getOperatorLogs);

router.get('/export/csv', recordController.exportRecords);
router.get('/:id/export/detail', recordController.exportRecordDetail);
router.get('/operator/:operator/export', recordController.exportOperatorLogs);

module.exports = router;
