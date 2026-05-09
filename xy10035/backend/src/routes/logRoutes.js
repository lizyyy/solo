const express = require('express');
const LogController = require('../controllers/LogController');

const router = express.Router();

router.post('/ingest', LogController.ingest);
router.get('/search', LogController.search);
router.get('/statistics', LogController.getStatistics);
router.get('/services', LogController.getServices);
router.get('/:id', LogController.getById);
router.delete('/cleanup', LogController.deleteOldLogs);

module.exports = router;
