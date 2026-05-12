const express = require('express');
const statsController = require('../controllers/statsController');

const router = express.Router();

router.get('/weekly', statsController.getWeeklyStats);
router.get('/trend', statsController.getTrendReport);
router.get('/dashboard', statsController.getDashboard);

module.exports = router;
