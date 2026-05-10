const express = require('express');
const SupplementTaskController = require('../controllers/SupplementTaskController');

const router = express.Router();

router.post('/create-from-declaration', SupplementTaskController.createFromDeclaration);
router.post('/create-manual', SupplementTaskController.createManualTask);
router.get('/', SupplementTaskController.getTasks);
router.get('/:taskId', SupplementTaskController.getTaskById);
router.post('/:taskId/start', SupplementTaskController.startTask);
router.post('/:taskId/complete', SupplementTaskController.completeTask);
router.post('/:taskId/cancel', SupplementTaskController.cancelTask);
router.get('/:taskId/check-completion', SupplementTaskController.checkTaskCompletion);
router.get('/statistics/summary', SupplementTaskController.getStatistics);

module.exports = router;
