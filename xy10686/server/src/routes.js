const express = require('express');
const router = express.Router();

const orderController = require('./controllers/orderController');
const deliveryController = require('./controllers/deliveryController');
const inspectionController = require('./controllers/inspectionController');
const reportController = require('./controllers/reportController');
const { getFlowRecords } = require('./services/flowService');
const { getAuditLogs } = require('./services/auditService');

router.get('/orders', orderController.getAllOrders);
router.get('/orders/:id', orderController.getOrderById);
router.post('/orders', orderController.createOrder);
router.put('/orders/:id', orderController.updateOrder);
router.delete('/orders/:id', orderController.deleteOrder);

router.get('/deliveries', deliveryController.getAllDeliveries);
router.get('/deliveries/:id', deliveryController.getDeliveryById);
router.post('/deliveries', deliveryController.createDelivery);
router.put('/deliveries/:id', deliveryController.updateDelivery);

router.get('/inspections', inspectionController.getAllInspections);
router.get('/inspections/:id', inspectionController.getInspectionById);
router.post('/inspections', inspectionController.createInspection);
router.put('/inspections/:id', inspectionController.updateInspection);
router.post('/inspections/:id/submit', inspectionController.submitInspection);
router.post('/inspections/:id/return', inspectionController.processReturn);
router.get('/deliveries/:deliveryId/return-check', inspectionController.getReturnInterception);

router.post('/payment/verify', inspectionController.verifyPaymentNode);

router.get('/dashboard', reportController.getDashboardData);
router.get('/reports/orders/export', reportController.exportOrdersReport);
router.get('/reports/inspections/export', reportController.exportInspectionsReport);
router.get('/audit-logs', reportController.getAuditLogs);

router.get('/flow-records/:orderId', async (req, res) => {
  try {
    const records = await getFlowRecords(req.params.orderId);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/audit-logs/:entityType/:entityId', async (req, res) => {
  try {
    const logs = await getAuditLogs(req.params.entityType, req.params.entityId);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
