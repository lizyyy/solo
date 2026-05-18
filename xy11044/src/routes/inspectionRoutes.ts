import { Router, Request, Response } from 'express';
import * as inspectionService from '../services/inspectionService';
import {
  CreateOrderRequest,
  UpdateOrderRequest,
  SubmitOrderRequest,
  WithdrawOrderRequest,
  ManualProcessRequest,
  AddRemarkRequest,
  InspectionStatus
} from '../types';

const router = Router();

router.post('/orders', async (req: Request, res: Response) => {
  try {
    const request: CreateOrderRequest = req.body;
    const order = await inspectionService.createOrder(request);
    res.status(201).json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/orders', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as InspectionStatus | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await inspectionService.getOrderList(page, pageSize, status, startDate, endDate);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const result = await inspectionService.getOrderWithItems(req.params.id);
    if (!result) {
      res.status(404).json({ error: '验收单不存在' });
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/orders/:id/history', async (req: Request, res: Response) => {
  try {
    const history = await inspectionService.getOrderHistory(req.params.id);
    res.json(history);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/orders/:id', async (req: Request, res: Response) => {
  try {
    const request: UpdateOrderRequest = req.body;
    const order = await inspectionService.updateOrder(req.params.id, request);
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/orders/:id/submit', async (req: Request, res: Response) => {
  try {
    const request: SubmitOrderRequest = req.body;
    const order = await inspectionService.submitOrder(req.params.id, request);
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/orders/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const request: WithdrawOrderRequest = req.body;
    const order = await inspectionService.withdrawOrder(req.params.id, request);
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/orders/:id/manual-process', async (req: Request, res: Response) => {
  try {
    const request: ManualProcessRequest = req.body;
    const order = await inspectionService.startManualProcess(req.params.id, request);
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/orders/:id/remark', async (req: Request, res: Response) => {
  try {
    const request: AddRemarkRequest = req.body;
    const order = await inspectionService.addRemark(req.params.id, request);
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/orders/:id/approve', async (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName, remark } = req.body;
    const order = await inspectionService.approveOrder(req.params.id, operatorId, operatorName, remark);
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/orders/:id/reject', async (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName, remark } = req.body;
    const order = await inspectionService.rejectOrder(req.params.id, operatorId, operatorName, remark);
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/daily/:date', async (req: Request, res: Response) => {
  try {
    const report = await inspectionService.getDailyReport(req.params.date);
    res.json(report);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/export/:date', async (req: Request, res: Response) => {
  try {
    const data = await inspectionService.exportReportData(req.params.date);
    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
