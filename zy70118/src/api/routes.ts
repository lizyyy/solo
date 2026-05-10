import { Router, Request, Response } from 'express';
import { InspectionService } from '../services';
import { CreateBatchRequest, TemperatureCheckRequest, WeightCheckRequest, TicketCheckRequest, RejectBatchRequest, ReplenishBatchRequest, AcceptBatchRequest } from '../domain';

export function createRouter(service: InspectionService): Router {
  const router = Router();

  router.get('/batches', async (req: Request, res: Response) => {
    const { supplierId, status, materialCode } = req.query as Record<string, string>;

    const batches = await service.listBatches({
      supplierId,
      status,
      materialCode
    });

    res.json({ success: true, data: batches });
  });

  router.get('/batches/:batchId', async (req: Request, res: Response) => {
    const { batchId } = req.params;
    const batch = await service.getBatch(batchId);

    if (!batch) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message: `批次不存在: ${batchId}`
        }
      });
      return;
    }

    res.json({ success: true, data: batch });
  });

  router.post('/batches', async (req: Request, res: Response) => {
    const request = req.body as CreateBatchRequest;
    const batch = await service.createBatch(request);

    res.status(201).json({ success: true, data: batch });
  });

  router.post('/batches/:batchId/temperature-check', async (req: Request, res: Response) => {
    const { batchId } = req.params;
    const request = { batchId, ...req.body } as TemperatureCheckRequest;

    const result = await service.performTemperatureCheck(request);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '温度检查失败',
          details: { errors: result.errors }
        }
      });
      return;
    }

    res.json({ success: true, data: result.batch });
  });

  router.post('/batches/:batchId/weight-check', async (req: Request, res: Response) => {
    const { batchId } = req.params;
    const request = { batchId, ...req.body } as WeightCheckRequest;

    const result = await service.performWeightCheck(request);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '重量检查失败',
          details: { errors: result.errors }
        }
      });
      return;
    }

    res.json({ success: true, data: result.batch });
  });

  router.post('/batches/:batchId/ticket-check', async (req: Request, res: Response) => {
    const { batchId } = req.params;
    const request = { batchId, ...req.body } as TicketCheckRequest;

    const result = await service.performTicketCheck(request);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '票证检查失败',
          details: { errors: result.errors }
        }
      });
      return;
    }

    res.json({ success: true, data: result.batch });
  });

  router.post('/batches/:batchId/reject', async (req: Request, res: Response) => {
    const { batchId } = req.params;
    const request = { batchId, ...req.body } as RejectBatchRequest;

    const result = await service.rejectBatch(request);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '拒收失败',
          details: { errors: result.errors }
        }
      });
      return;
    }

    res.json({ success: true, data: result.batch });
  });

  router.post('/batches/:batchId/replenish', async (req: Request, res: Response) => {
    const { batchId } = req.params;
    const request = { batchId, ...req.body } as ReplenishBatchRequest;

    const result = await service.replenishBatch(request);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '补货登记失败',
          details: { errors: result.errors }
        }
      });
      return;
    }

    res.json({ success: true, data: result.batch });
  });

  router.post('/batches/:batchId/accept', async (req: Request, res: Response) => {
    const { batchId } = req.params;
    const request = { batchId, ...req.body } as AcceptBatchRequest;

    const result = await service.acceptBatch(request);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '验收失败',
          details: { errors: result.errors }
        }
      });
      return;
    }

    res.json({ success: true, data: result.batch });
  });

  router.get('/batches/:batchId/report', async (req: Request, res: Response) => {
    const { batchId } = req.params;
    const report = await service.generateReport(batchId);

    res.json({ success: true, data: report });
  });

  return router;
}
