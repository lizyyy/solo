const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission } = require('../middleware/auth');

const orderController = require('../controllers/orderController');
const messageController = require('../controllers/messageController');
const maintenanceController = require('../controllers/maintenanceController');
const workflowController = require('../controllers/workflowController');
const batchController = require('../controllers/batchController');
const taskController = require('../controllers/taskController');
const auditController = require('../controllers/auditController');
const exportController = require('../controllers/exportController');

router.use(authMiddleware);

router.get('/health', (req, res) => {
  res.json({ success: true, message: '服务运行正常', user: req.user });
});

router.post('/orders', requirePermission('order:create'), orderController.createOrder);
router.put('/orders/:id', requirePermission('order:update'), orderController.updateOrder);
router.get('/orders/:id', requirePermission('order:view'), orderController.getOrder);
router.get('/orders', requirePermission('order:view'), orderController.listOrders);
router.post('/orders/import', requirePermission('order:create'), orderController.importOrders);
router.get('/orders/:id/history', requirePermission('order:view'), orderController.getOrderHistory);
router.get('/orders/:id/workflow', requirePermission('order:view'), orderController.getOrderWorkflow);
router.get('/conflicts/orders', requirePermission('order:view'), orderController.getOrderConflicts);

router.post('/messages', requirePermission('message:create'), messageController.createMessage);
router.put('/messages/:id', requirePermission('message:update'), messageController.updateMessage);
router.get('/messages/:id', requirePermission('message:view'), messageController.getMessage);
router.get('/messages', requirePermission('message:view'), messageController.listMessages);
router.post('/messages/import', requirePermission('message:create'), messageController.importMessages);
router.get('/messages/:id/history', requirePermission('message:view'), messageController.getMessageHistory);
router.get('/messages/:id/workflow', requirePermission('message:view'), messageController.getMessageWorkflow);

router.post('/maintenance', requirePermission('maintenance:create'), maintenanceController.createNote);
router.put('/maintenance/:id', requirePermission('maintenance:update'), maintenanceController.updateNote);
router.get('/maintenance/:id', requirePermission('maintenance:view'), maintenanceController.getNote);
router.get('/maintenance', requirePermission('maintenance:view'), maintenanceController.listNotes);
router.post('/maintenance/import', requirePermission('maintenance:create'), maintenanceController.importNotes);
router.get('/maintenance/:id/history', requirePermission('maintenance:view'), maintenanceController.getNoteHistory);
router.get('/maintenance/:id/workflow', requirePermission('maintenance:view'), maintenanceController.getNoteWorkflow);

router.post('/workflow/submit', workflowController.submit);
router.post('/workflow/reject', requirePermission('workflow:reject'), workflowController.reject);
router.post('/workflow/confirm', requirePermission('workflow:confirm'), workflowController.confirm);
router.post('/workflow/audit', requirePermission('workflow:audit'), workflowController.audit);

router.get('/batches/:id', requirePermission('batch:view'), batchController.getBatch);
router.get('/batches', requirePermission('batch:view'), batchController.listBatches);

router.get('/tasks/:id', requirePermission('task:view'), taskController.getTask);
router.get('/tasks', requirePermission('task:view'), taskController.listTasks);
router.get('/tasks/failed', requirePermission('task:view'), taskController.listFailedTasks);
router.post('/tasks/:id/retry', requirePermission('task:retry'), taskController.retry);
router.post('/tasks', taskController.create);

router.get('/audit/history', requirePermission('history:view'), auditController.listHistory);
router.get('/users', auditController.listUsers);

router.post('/export/orders', requirePermission('export:view'), exportController.exportOrders);
router.post('/export/messages', requirePermission('export:view'), exportController.exportMessages);
router.post('/export/maintenance', requirePermission('export:view'), exportController.exportMaintenance);
router.get('/export/download/:filename', requirePermission('export:download'), exportController.downloadFile);

router.get('/report', exportController.getReport);

module.exports = router;
