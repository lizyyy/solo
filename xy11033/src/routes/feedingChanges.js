const express = require('express');
const router = express.Router();
const controller = require('../controllers/feedingChangeController');

function wrapAsync(fn) {
  return function(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.post('/', wrapAsync(controller.createFeedingChange));
router.get('/', wrapAsync(controller.listFeedingChanges));
router.get('/normal', wrapAsync(controller.getNormalRecords));
router.get('/abnormal', wrapAsync(controller.getAbnormalRecords));
router.get('/transitions', controller.getStatusTransitions);
router.get('/:id', wrapAsync(controller.getFeedingChange));
router.get('/:id/logs', wrapAsync(controller.getStatusLogs));
router.get('/:id/can-do/:action', wrapAsync(controller.checkCanPerformAction));
router.post('/:id/actions', wrapAsync(controller.performAction));

module.exports = router;
