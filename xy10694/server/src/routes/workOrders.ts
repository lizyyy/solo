import express from 'express';
import WorkOrderService from '../services/WorkOrderService';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await WorkOrderService.createWorkOrder(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await WorkOrderService.getWorkOrderList(req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await WorkOrderService.getWorkOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: '工单不存在' });
    }
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const logs = await WorkOrderService.getOperationLogs(req.params.id);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/process', async (req, res) => {
  try {
    const result = await WorkOrderService.processWorkOrder({
      orderId: req.params.id,
      ...req.body
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const result = await WorkOrderService.completeWorkOrder({
      orderId: req.params.id,
      ...req.body
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const result = await WorkOrderService.reviewWorkOrder({
      orderId: req.params.id,
      ...req.body
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats/dissatisfaction', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await WorkOrderService.getDissatisfactionStats(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
