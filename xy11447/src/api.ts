import express, { Request, Response } from 'express';
import { createObjectCsvWriter } from 'csv-writer';
import { queueService } from './service';
import {
  CreateWorkOrderRequest,
  UpdateStatusRequest,
  QueryParams,
  RetryCategory,
} from './types';

export const apiRouter = express.Router();

apiRouter.post('/workorders', (req: Request, res: Response) => {
  try {
    const request: CreateWorkOrderRequest = req.body;
    if (!request.source || !request.sourceId || !request.sourceData || !request.operator) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const workOrder = queueService.createWorkOrder(request);
    res.status(201).json(workOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.get('/workorders', (req: Request, res: Response) => {
  try {
    const params: QueryParams = {
      status: req.query.status as any,
      source: req.query.source as any,
      retryCategory: req.query.retryCategory as any,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    };
    const result = queueService.queryWorkOrders(params);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.get('/workorders/:id', (req: Request, res: Response) => {
  try {
    const workOrder = queueService.getWorkOrder(req.params.id);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.get('/workorders/orderNo/:orderNo', (req: Request, res: Response) => {
  try {
    const workOrder = queueService.getWorkOrderByOrderNo(req.params.orderNo);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.get('/workorders/:id/history', (req: Request, res: Response) => {
  try {
    const history = queueService.getStatusHistory(req.params.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.put('/workorders/:id/status', (req: Request, res: Response) => {
  try {
    const request: UpdateStatusRequest = req.body;
    if (!request.status || !request.operator || !request.reason) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const workOrder = queueService.updateWorkOrderStatus(req.params.id, request);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.post('/workorders/:id/enqueue', (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    if (!operator) {
      return res.status(400).json({ error: '缺少操作者' });
    }
    const workOrder = queueService.enqueueWorkOrder(req.params.id, operator);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.post('/workorders/:id/retry', (req: Request, res: Response) => {
  try {
    const { operator, retryCategory } = req.body;
    if (!operator || !retryCategory) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const workOrder = queueService.retryWorkOrder(
      req.params.id,
      operator,
      retryCategory as RetryCategory
    );
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.post('/workorders/:id/manual', (req: Request, res: Response) => {
  try {
    const { operator, reason } = req.body;
    if (!operator || !reason) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const workOrder = queueService.manualTakeover(req.params.id, operator, reason);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.post('/workorders/:id/compensate', (req: Request, res: Response) => {
  try {
    const { operator, amount } = req.body;
    if (!operator || amount === undefined) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const workOrder = queueService.compensateWorkOrder(req.params.id, operator, amount);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.post('/workorders/:id/close', (req: Request, res: Response) => {
  try {
    const { operator, reason } = req.body;
    if (!operator || !reason) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const workOrder = queueService.closeWorkOrder(req.params.id, operator, reason);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.get('/dirty-records', (req: Request, res: Response) => {
  try {
    const workOrderId = req.query.workOrderId as string | undefined;
    const records = queueService.getDirtyRecords(workOrderId);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.put('/dirty-records/:id/resolve', (req: Request, res: Response) => {
  try {
    const { operator, opinion } = req.body;
    if (!operator || !opinion) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const record = queueService.resolveDirtyRecord(req.params.id, operator, opinion);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.get('/dashboard', (req: Request, res: Response) => {
  try {
    const dashboard = queueService.getAreaManagerDashboard();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'json';
    const status = req.query.status as any;
    const source = req.query.source as any;

    const data = queueService.exportWorkOrders({ status, source });

    if (format === 'csv') {
      const csvWriter = createObjectCsvWriter({
        path: '/tmp/export.csv',
        header: [
          { id: 'orderNo', title: '工单号' },
          { id: 'source', title: '来源' },
          { id: 'status', title: '状态' },
          { id: 'retryCount', title: '重试次数' },
          { id: 'retryCategory', title: '重试分类' },
          { id: 'faultDurationMinutes', title: '故障时长(分钟)' },
          { id: 'compensationAmount', title: '补偿金额' },
          { id: 'createdAt', title: '创建时间' },
          { id: 'closedAt', title: '关闭时间' },
        ],
      });

      await csvWriter.writeRecords(
        data.map(d => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
          closedAt: d.closedAt?.toISOString() || '',
        }))
      );

      res.download('/tmp/export.csv', 'workorders.csv');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=workorders.json');
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
