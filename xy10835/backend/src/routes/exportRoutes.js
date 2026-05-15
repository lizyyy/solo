const express = require('express');
const router = express.Router();
const ExportController = require('../controllers/exportController');

router.post('/tasks', ExportController.createExport);
router.get('/tasks', ExportController.getTaskList);
router.get('/tasks/:id', ExportController.getTaskDetail);
router.post('/tasks/:id/retry', ExportController.retryTask);
router.post('/tasks/:id/correct', ExportController.correctAndRetry);
router.get('/tasks/:id/download', ExportController.downloadExport);
router.post('/tasks/:id/permission', ExportController.grantPermission);

router.get('/events', ExportController.getOperationEvents);
router.get('/users', ExportController.getUsers);

module.exports = router;
