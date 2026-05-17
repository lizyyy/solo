const express = require('express');
const router = express.Router();
const compensationController = require('../controllers/compensationController');

router.post('/', compensationController.createRecord);
router.get('/', compensationController.getRecords);
router.get('/:id', compensationController.getRecord);
router.get('/:id/history', compensationController.getHistory);
router.post('/:id/release', compensationController.requestRelease);
router.post('/:id/approve', compensationController.approveRelease);
router.post('/:id/start-compensation', compensationController.startCompensation);
router.post('/:id/complete', compensationController.completeCompensation);
router.post('/:id/reject', compensationController.rejectRecord);
router.get('/conflicts/check', compensationController.checkConflicts);
router.post('/export', compensationController.exportRecords);

module.exports = router;
