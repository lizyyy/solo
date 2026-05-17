import { Router, Request, Response } from 'express';
import { service } from './service';
import {
  CreateChangeOrderRequest,
  FreezeDependencyRequest,
  ConfirmDependencyRequest,
  DelayDependencyRequest,
  ExceptionRequest,
  ManualCorrectionRequest
} from './types';

const router = Router();

router.post('/change-orders', (req: Request, res: Response) => {
  const body = req.body as CreateChangeOrderRequest;
  
  if (!body.changeOrderNo || !body.title || !body.createdBy || !body.dependencies) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_REQUIRED_FIELDS',
      message: '缺少必填字段'
    });
  }

  const result = service.createChangeOrder(body);
  
  if (!result.success && result.error === 'DUPLICATE_CHANGE_ORDER_NO') {
    return res.status(200).json(result);
  }
  
  res.status(result.success ? 201 : 400).json(result);
});

router.get('/change-orders', (req: Request, res: Response) => {
  const result = service.getAllChangeOrders();
  res.json(result);
});

router.get('/change-orders/:id', (req: Request, res: Response) => {
  const result = service.getChangeOrderById(req.params.id);
  res.status(result.success ? 200 : 404).json(result);
});

router.get('/change-orders/no/:changeOrderNo', (req: Request, res: Response) => {
  const result = service.getChangeOrderByNo(req.params.changeOrderNo);
  res.status(result.success ? 200 : 404).json(result);
});

router.post('/change-orders/:id/start-freeze', (req: Request, res: Response) => {
  const body = req.body as FreezeDependencyRequest;
  const result = service.startFreeze(req.params.id, body);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/change-orders/:id/dependencies/:dependencyId/freeze', (req: Request, res: Response) => {
  const body = req.body as FreezeDependencyRequest;
  const result = service.freezeDependency(req.params.id, req.params.dependencyId, body);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/change-orders/:id/dependencies/:dependencyId/confirm', (req: Request, res: Response) => {
  const body = req.body as ConfirmDependencyRequest;
  const result = service.confirmDependency(req.params.id, req.params.dependencyId, body);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/change-orders/:id/dependencies/:dependencyId/delay', (req: Request, res: Response) => {
  const body = req.body as DelayDependencyRequest;
  const result = service.delayDependency(req.params.id, req.params.dependencyId, body);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/change-orders/:id/exception', (req: Request, res: Response) => {
  const body = req.body as ExceptionRequest;
  const result = service.markException(req.params.id, body);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/change-orders/:id/manual-correction', (req: Request, res: Response) => {
  const body = req.body as ManualCorrectionRequest;
  const result = service.manualCorrection(req.params.id, body);
  res.status(result.success ? 200 : 400).json(result);
});

router.get('/change-orders/:id/export', (req: Request, res: Response) => {
  const result = service.exportChangeOrder(req.params.id);
  if (!result.success) {
    return res.status(404).json(result);
  }
  
  const format = req.query.format as string;
  if (format === 'csv') {
    const data = result.data;
    let csv = '字段,值\n';
    csv += `变更单号,${data.changeOrderNo}\n`;
    csv += `标题,${data.title}\n`;
    csv += `状态,${data.status}\n`;
    csv += `创建人,${data.createdBy}\n`;
    csv += `创建时间,${data.createdAt}\n\n`;
    
    csv += '依赖服务状态\n';
    csv += '服务名称,状态,冻结窗口,确认人,延期原因,异常原因\n';
    data.dependencySummary.forEach((dep: any) => {
      csv += `${dep.serviceName},${dep.status},${dep.freezeWindow},${dep.confirmer},${dep.delayReason},${dep.exceptionReason}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="change-order-${data.changeOrderNo}.csv"`);
    return res.send(csv);
  }
  
  res.json(result);
});

router.post('/change-orders/:id/approve', (req: Request, res: Response) => {
  const { operator } = req.body;
  const result = service.approveChangeOrder(req.params.id, operator);
  res.status(result.success ? 200 : 400).json(result);
});

export default router;
