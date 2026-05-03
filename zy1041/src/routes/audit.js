const express = require('express');
const AuditController = require('../controllers/auditController');

const router = express.Router();

router.get('/request/:request_id', AuditController.getRequestAuditLog);
router.get('/request/:request_id/markdown', AuditController.exportToMarkdown);
router.get('/daily-report', AuditController.exportDailyReport);

module.exports = router;
