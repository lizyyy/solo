const express = require('express');
const router = express.Router();
const {
  exportRecordsCSV,
  getExportSummary
} = require('../controllers/exportController');

router.get('/summary', getExportSummary);
router.get('/records', exportRecordsCSV);

module.exports = router;
