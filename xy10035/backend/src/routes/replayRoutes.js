const express = require('express');
const ReplayController = require('../controllers/ReplayController');

const router = express.Router();

router.get('/traces', ReplayController.listTraces);
router.get('/trace/:traceId', ReplayController.getTimeline);
router.get('/trace/:traceId/summary', ReplayController.getTraceSummary);
router.get('/trace/:traceId/step/:stepIndex', ReplayController.getStep);
router.get('/trace/:traceId/search', ReplayController.searchInTrace);
router.get('/trace/:traceId/critical', ReplayController.getCriticalPath);
router.get('/trace/:traceId/export', ReplayController.exportTraceForReplay);

module.exports = router;
