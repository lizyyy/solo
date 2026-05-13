const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/contracts', reportController.exportContracts);
router.get('/changelogs', reportController.getChangeLogs);

module.exports = router;
