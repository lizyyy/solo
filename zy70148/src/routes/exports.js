const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

router.get('/requests', exportController.exportRequests);
router.get('/requests/:id', exportController.exportRequestDetail);
router.get('/statistics', exportController.exportStatistics);

module.exports = router;