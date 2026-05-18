import { Router, Request, Response } from 'express';
import * as reissueService from '../services/reissueService';
import * as importService from '../services/importService';
import { CreateReissueOrderRequest, ReissueStatus, UpdateReissueStatusRequest } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const request: CreateReissueOrderRequest = req.body;
    const order = await reissueService.createReissueOrder(request);
    res.status(201).json({ success: true, data: order });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as ReissueStatus | undefined;
    const leaderId = req.query.leaderId as string | undefined;

    const result = await reissueService.getReissueOrders(page, pageSize, status, leaderId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const statistics = await reissueService.getReissueStatistics(startDate, endDate);
    res.json({ success: true, data: statistics });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const order = await reissueService.getReissueOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: '补发单不存在' });
    }

    const items = await reissueService.getReissueItemsByOrderId(req.params.id);
    const history = await reissueService.getReissueHistoryByOrderId(req.params.id);

    res.json({
      success: true,
      data: {
        order,
        items,
        history
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/items', async (req: Request, res: Response) => {
  try {
    const items = await reissueService.getReissueItemsByOrderId(req.params.id);
    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const history = await reissueService.getReissueHistoryByOrderId(req.params.id);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const request: UpdateReissueStatusRequest = req.body;
    const order = await reissueService.updateReissueStatus(req.params.id, request);
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/resubmit', async (req: Request, res: Response) => {
  try {
    const request: UpdateReissueStatusRequest = req.body;
    const order = await reissueService.resubmitReissueOrder(req.params.id, request);
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/import/excel', async (req: Request, res: Response) => {
  try {
    const { filePath, createdBy } = req.body;
    const result = await importService.importFromExcel(filePath, createdBy);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/import/csv', async (req: Request, res: Response) => {
  try {
    const { filePath, createdBy } = req.body;
    const result = await importService.importFromCSV(filePath, createdBy);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/import/template', (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'xlsx';
    const fileName = `补发单导入模板.${format}`;
    const filePath = `/tmp/${fileName}`;

    importService.generateTemplate(filePath, format as 'csv' | 'xlsx');

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('下载模板失败:', err);
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
