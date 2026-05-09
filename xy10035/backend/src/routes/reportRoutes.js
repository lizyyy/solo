const express = require('express');
const ReportController = require('../controllers/ReportController');

const router = express.Router();

router.post('/generate', ReportController.generate);
router.post('/preview', ReportController.getPreview);
router.get('/', ReportController.list);
router.get('/:reportId', ReportController.getById);
router.post('/:reportId/export', ReportController.exportExisting);

module.exports = router;
