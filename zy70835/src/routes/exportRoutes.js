const express = require('express');
const router = express.Router();
const ExportController = require('../controllers/exportController');

router.get('/csv/:check_date', ExportController.exportCSV);
router.get('/download/:check_date', ExportController.downloadCSV);
router.get('/statistics/:check_date', ExportController.getStatistics);

module.exports = router;