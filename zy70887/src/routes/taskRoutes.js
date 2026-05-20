const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

router.post('/', taskController.submitTask);
router.get('/', taskController.listTasks);
router.get('/:taskId', taskController.getTask);
router.put('/:taskId/status', taskController.updateTaskStatus);
router.post('/:taskId/courier', taskController.sendToCourier);

module.exports = router;
