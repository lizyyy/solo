import express from 'express';
import { orderService } from '../services/OrderService';
import { dataStore } from '../services/DataStore';
import { inventoryService } from '../services/InventoryService';
import { reportService } from '../services/ReportService';
import { testDataService } from '../services/TestDataService';

const router = express.Router();

router.get('/init-test-data', async (req, res) => {
  try {
    const result = await testDataService.initializeAllTestData();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', (req, res) => {
  const orders = orderService.getAllOrders();
  res.json({ success: true, data: orders });
});

router.get('/:orderId', (req, res) => {
  const order = orderService.getOrder(req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  const timeline = dataStore.getTimeline(req.params.orderId);
  const pickingRecords = dataStore.getPickingRecords(req.params.orderId);
  const outOfStockItems = dataStore.getOutOfStockItems(req.params.orderId);
  
  res.json({
    success: true,
    data: {
      order,
      timeline,
      pickingRecords,
      outOfStockItems
    }
  });
});

router.post('/', async (req, res) => {
  try {
    const { orderData, operatorId, operatorName } = req.body;
    const result = await orderService.createOrder(orderData, operatorId, operatorName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:orderId/pay', async (req, res) => {
  try {
    const { operatorId, operatorName } = req.body;
    const result = await orderService.payOrder(req.params.orderId, operatorId, operatorName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:orderId/start-picking', async (req, res) => {
  try {
    const { operatorId, operatorName } = req.body;
    const result = await orderService.startPicking(req.params.orderId, operatorId, operatorName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:orderId/record-picking', async (req, res) => {
  try {
    const { orderItemId, pickedQuantity, operatorId, operatorName, notes } = req.body;
    const result = await orderService.recordPicking(
      req.params.orderId,
      orderItemId,
      pickedQuantity,
      operatorId,
      operatorName,
      notes
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:orderId/complete-picking', async (req, res) => {
  try {
    const { operatorId, operatorName } = req.body;
    const result = await orderService.completePicking(req.params.orderId, operatorId, operatorName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:orderId/deliver', async (req, res) => {
  try {
    const { operatorId, operatorName } = req.body;
    const result = await orderService.deliverOrder(req.params.orderId, operatorId, operatorName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:orderId/complete', async (req, res) => {
  try {
    const { operatorId, operatorName } = req.body;
    const result = await orderService.completeOrder(req.params.orderId, operatorId, operatorName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:orderId/replacement', async (req, res) => {
  try {
    const { orderItemId, replacementProductId, operatorId, operatorName, reason } = req.body;
    const result = await orderService.confirmReplacement(
      req.params.orderId,
      orderItemId,
      replacementProductId,
      operatorId,
      operatorName,
      reason
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/refund-callback', async (req, res) => {
  try {
    const result = await orderService.processRefundCallback(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:orderId/release-inventory', async (req, res) => {
  try {
    const { items, operatorId, operatorName, reason } = req.body;
    const result = await inventoryService.releaseInventory(
      req.params.orderId,
      items,
      operatorId,
      operatorName,
      reason
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:orderId/out-of-stock', (req, res) => {
  const items = orderService.getOutOfStockItems(req.params.orderId);
  res.json({ success: true, data: items });
});

router.get('/:orderId/timeline', (req, res) => {
  const timeline = dataStore.getTimeline(req.params.orderId);
  res.json({ success: true, data: timeline });
});

router.get('/:orderId/picking-records', (req, res) => {
  const records = dataStore.getPickingRecords(req.params.orderId);
  res.json({ success: true, data: records });
});

router.get('/:orderId/modified-history', (req, res) => {
  try {
    const history = reportService.getModifiedHistory(req.params.orderId);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:orderId/report', (req, res) => {
  try {
    const report = reportService.generateReport(req.params.orderId);
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:orderId/report/csv', (req, res) => {
  try {
    const csv = reportService.exportReportToCSV(req.params.orderId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=order-report-${req.params.orderId}.csv`);
    res.send('\ufeff' + csv);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/reports/filter', (req, res) => {
  try {
    const reports = reportService.filterReports(req.body);
    res.json({ success: true, data: reports });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
