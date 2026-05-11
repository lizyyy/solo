const express = require('express');
const queryController = require('../controllers/queryController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/records', authenticateToken, queryController.getAccessRecords);
router.get('/statistics', authenticateToken, queryController.getStatistics);
router.get('/exception-summary', authenticateToken, requireRole(['admin']), queryController.exportExceptionSummary);

module.exports = router;
