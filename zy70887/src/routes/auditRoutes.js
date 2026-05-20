const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');

router.get('/', auditController.getAuditLogs);
router.get('/task/:taskId', auditController.getTaskAuditLogs);
router.get('/material/:materialId', auditController.getMaterialAuditLogs);
router.get('/material/:materialId/history', auditController.getMaterialModificationHistory);

module.exports = router;
