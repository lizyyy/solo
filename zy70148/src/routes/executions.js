const express = require('express');
const router = express.Router();
const executionController = require('../controllers/executionController');

router.post('/:request_id/start', executionController.startExecution);
router.post('/:request_id/complete', executionController.completeExecution);
router.post('/:request_id/rollback-request', executionController.requestRollback);
router.post('/:request_id/execute-rollback', executionController.executeRollback);
router.get('/:request_id/history', executionController.getExecutionHistory);
router.post('/:request_id/rollback-scripts', executionController.addRollbackScript);
router.get('/:request_id/rollback-scripts', executionController.getRollbackScripts);

module.exports = router;