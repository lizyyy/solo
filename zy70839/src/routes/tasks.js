const express = require('express');
const TaskController = require('../controllers/taskController');

const router = express.Router();

router.post('/submit', TaskController.submitMaterials);
router.get('/statistics', TaskController.getStatistics);
router.patch('/:taskId/status', TaskController.updateTaskStatus);
router.get('/:taskId/audit-logs', TaskController.getAuditLogs);
router.post('/:taskId/export', TaskController.exportTask);
router.get('/:taskId/export-history', TaskController.getExportHistory);
router.get('/:taskId', TaskController.getTaskDetail);
router.get('/', TaskController.getTaskList);

module.exports = router;