const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

router.post('/task/:taskId', exportController.exportTask);
router.get('/', exportController.listReports);
router.get('/task/:taskId', exportController.getReportByTaskId);
router.get('/no/:reportNo', exportController.getReportByReportNo);
router.get('/:reportId/trace', exportController.getReportFullTrace);

module.exports = router;
