const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');

router.get('/actions', auditController.getAuditActions);

router.get('/contract/:contractId', auditController.getContractAuditTrail);

router.get('/operation/:operationId', auditController.getAuditLogByOperationId);

module.exports = router;
