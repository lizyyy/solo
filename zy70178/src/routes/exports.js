const express = require('express');
const router = express.Router();
const ExportController = require('../controllers/ExportController');

router.get('/contracts/:contractId/finance', ExportController.exportContractForFinance);
router.get('/contracts/:contractId/history', ExportController.exportVersionHistory);
router.get('/tax-summary', ExportController.exportTaxSummary);

module.exports = router;
