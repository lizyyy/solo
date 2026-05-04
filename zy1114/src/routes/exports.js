const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

router.get('/shift-handover', exportController.exportShiftHandover);
router.get('/daily-reconciliation', exportController.exportDailyReconciliation);
router.get('/repair-todo', exportController.exportRepairTodo);

module.exports = router;
