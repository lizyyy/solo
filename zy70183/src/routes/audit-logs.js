const express = require('express');
const AuditLogController = require('../controllers/AuditLogController');

const router = express.Router();

router.get('/', AuditLogController.getLogs);
router.get('/:enterpriseCode/:periodCode', AuditLogController.getLogsByEntity);

module.exports = router;
