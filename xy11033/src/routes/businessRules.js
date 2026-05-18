const express = require('express');
const router = express.Router();
const controller = require('../controllers/feedingChangeController');

function wrapAsync(fn) {
  return function(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.get('/inventory-check', wrapAsync(controller.checkInventoryConflict));
router.get('/report-consistency', wrapAsync(controller.checkReportConsistency));

module.exports = router;
