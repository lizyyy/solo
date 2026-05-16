const express = require('express');
const router = express.Router();
const controller = require('../controllers/CorrectionController');

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'event-sourcing-correction-api', timestamp: new Date().toISOString() });
});

router.post('/aggregates', (req, res) => controller.createAggregate(req, res));
router.get('/aggregates', (req, res) => controller.listAggregates(req, res));
router.get('/aggregates/:aggregateId', (req, res) => controller.getAggregate(req, res));

router.post('/events', (req, res) => controller.addOriginalEvent(req, res));
router.get('/events/:eventId', (req, res) => controller.getEvent(req, res));

router.post('/corrections', (req, res) => controller.createCorrection(req, res));
router.get('/corrections', (req, res) => controller.listCorrections(req, res));
router.get('/corrections/:correctionId', (req, res) => controller.getCorrection(req, res));
router.post('/corrections/:correctionId/replay', (req, res) => controller.replayAndValidate(req, res));
router.post('/corrections/:correctionId/apply', (req, res) => controller.applyCorrection(req, res));
router.post('/corrections/:correctionId/report', (req, res) => controller.generateReport(req, res));
router.post('/corrections/:correctionId/handle-failed', (req, res) => controller.handleFailedCorrection(req, res));
router.post('/corrections/:correctionId/manual', (req, res) => controller.manualCorrection(req, res));

router.get('/reports/:reportId', (req, res) => controller.getReport(req, res));
router.get('/reports/:reportId/export', (req, res) => controller.exportReport(req, res));

module.exports = router;
