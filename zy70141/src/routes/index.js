const express = require('express');
const shortLinkController = require('../controllers/shortLinkController');
const conversionController = require('../controllers/conversionController');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.get('/:shortCode', shortLinkController.handleRedirect);

router.get('/stats/:shortCode', shortLinkController.getShortLinkStats);

router.post('/api/v1/conversions', conversionController.createConversion);
router.get('/api/v1/conversions/stats', conversionController.getConversionStats);

router.post('/api/v1/tasks/rerun/:taskId', taskController.rerunTask);
router.post('/api/v1/tasks/rerun-all', taskController.rerunAllFailed);
router.get('/api/v1/tasks/failed', taskController.listFailedTasks);
router.post('/api/v1/tasks/process-conversions', taskController.processPendingConversions);
router.post('/api/v1/reports/attribution', taskController.generateReport);

module.exports = router;
