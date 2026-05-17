const express = require('express');
const router = express.Router();
const HandoverController = require('../controllers/handoverController');

router.post('/customers', HandoverController.createCustomer);

router.post('/configs', HandoverController.createConfigItem);
router.get('/configs/:id', HandoverController.getConfigItem);
router.get('/customers/:customerId/configs', HandoverController.getCustomerConfigs);

router.post('/configs/:id/status', HandoverController.advanceStatus);
router.post('/configs/:id/confirm', HandoverController.confirmConfig);
router.post('/configs/:id/correct', HandoverController.manualCorrection);
router.post('/configs/:id/sources', HandoverController.addSourceMaterial);
router.get('/configs/:id/changes', HandoverController.compareChanges);

router.get('/exceptions', HandoverController.getExceptions);
router.post('/exceptions/:id/handle', HandoverController.handleException);

router.post('/customers/:customerId/summaries', HandoverController.generateHandoverSummary);
router.get('/customers/:customerId/summaries', HandoverController.getHandoverSummaries);

router.get('/customers/:customerId/export', HandoverController.exportConfig);

module.exports = router;
