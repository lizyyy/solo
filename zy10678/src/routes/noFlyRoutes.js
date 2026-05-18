const express = require('express');
const router = express.Router();
const noFlyController = require('../controllers/NoFlyController');

router.get('/reference', noFlyController.getReferenceData);
router.get('/status-info', noFlyController.getStatusInfo);

router.post('/', noFlyController.createRecord);
router.get('/', noFlyController.getRecords);
router.get('/export', noFlyController.exportRecords);
router.get('/:id', noFlyController.getRecordById);
router.get('/:id/history', noFlyController.getHistory);
router.patch('/:id/status', noFlyController.changeStatus);

router.post('/import', noFlyController.importRecords);
router.get('/import/:batchId/validation', noFlyController.getImportValidation);

module.exports = router;