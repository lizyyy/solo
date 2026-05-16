const express = require('express');
const router = express.Router();
const StrategyController = require('../controllers/strategyController');

router.post('/', StrategyController.createStrategy);
router.get('/', StrategyController.listStrategies);
router.get('/statistics', StrategyController.getStatistics);
router.get('/export', StrategyController.exportStrategies);
router.get('/:id', StrategyController.getStrategy);
router.get('/:id/export-impact', StrategyController.exportImpactSummary);

router.put('/:id/status', StrategyController.updateStatus);
router.post('/:id/publish', StrategyController.publishStrategy);
router.post('/:id/activate', StrategyController.activateStrategy);
router.post('/:id/compensate', StrategyController.compensateStrategy);
router.post('/:id/revoke', StrategyController.revokeStrategy);
router.post('/:id/manual-correct', StrategyController.manualCorrect);
router.post('/:id/failure', StrategyController.recordFailure);
router.post('/:id/impact-record', StrategyController.addImpactRecord);

router.post('/match', StrategyController.matchStrategies);

module.exports = router;
