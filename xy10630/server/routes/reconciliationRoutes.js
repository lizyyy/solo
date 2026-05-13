const express = require('express');
const router = express.Router();
const { 
  getReconciliations, 
  createReconciliation, 
  exportData, 
  getAuditLogs, 
  getFreezeLogs, 
  getDashboardStats 
} = require('../controllers/reconciliationController');
const { auditLog } = require('../middleware/audit');

router.get('/', getReconciliations);
router.post('/', auditLog('create', 'reconciliation'), createReconciliation);
router.get('/export', exportData);
router.get('/audit', getAuditLogs);
router.get('/freeze-logs', getFreezeLogs);
router.get('/dashboard', getDashboardStats);

module.exports = router;
