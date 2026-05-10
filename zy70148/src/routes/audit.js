const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');

router.post('/:request_id', auditController.generateAuditReport);
router.get('/:request_id', auditController.getAuditReports);
router.get('/report/:id', auditController.getAuditReportDetail);

module.exports = router;