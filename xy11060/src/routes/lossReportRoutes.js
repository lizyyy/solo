const express = require('express');
const router = express.Router();
const multer = require('multer');
const lossReportController = require('../controllers/lossReportController');

const upload = multer({ dest: 'uploads/' });

router.post('/', lossReportController.createReport.bind(lossReportController));
router.post('/batch', upload.single('file'), lossReportController.batchImport.bind(lossReportController));
router.get('/', lossReportController.getReports.bind(lossReportController));
router.get('/export', lossReportController.exportReports.bind(lossReportController));
router.get('/:id', lossReportController.getReport.bind(lossReportController));
router.put('/:id', lossReportController.updateReport.bind(lossReportController));
router.post('/:id/audit', lossReportController.auditReport.bind(lossReportController));

module.exports = router;
