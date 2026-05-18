import { Router, Request, Response } from 'express';
import { orderService } from '../services/orderService';
import { schedulingService } from '../services/schedulingService';
import { ApiResponse, OrderStatus } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { status, urgency, dateFrom, dateTo } = req.query;
  
  const orders = orderService.listOrders({
    status: status as OrderStatus,
    urgency: urgency as any,
    dateFrom: dateFrom as string,
    dateTo: dateTo as string
  });

  const response: ApiResponse = {
    code: 200,
    message: '获取订单列表成功',
    data: orders
  };
  res.json(response);
});

router.get('/:id', (req: Request, res: Response) => {
  const order = orderService.getOrderDetail(req.params.id);
  
  if (!order) {
    const response: ApiResponse = {
      code: 404,
      message: '订单不存在'
    };
    return res.status(404).json(response);
  }

  const response: ApiResponse = {
    code: 200,
    message: '获取订单详情成功',
    data: order
  };
  res.json(response);
});

router.get('/:id/history', (req: Request, res: Response) => {
  const history = orderService.getOrderHistory(req.params.id);
  
  const response: ApiResponse = {
    code: 200,
    message: '获取订单历史记录成功',
    data: history
  };
  res.json(response);
});

router.post('/', (req: Request, res: Response) => {
  const operator = req.headers['x-operator'] as string || 'system';
  const order = orderService.createOrder(req.body, operator);

  const response: ApiResponse = {
    code: 201,
    message: '创建订单成功',
    data: order
  };
  res.status(201).json(response);
});

router.put('/:id', (req: Request, res: Response) => {
  const operator = req.headers['x-operator'] as string || 'system';
  const order = orderService.updateOrder(req.params.id, req.body, operator);

  if (!order) {
    const response: ApiResponse = {
      code: 404,
      message: '订单不存在'
    };
    return res.status(404).json(response);
  }

  const response: ApiResponse = {
    code: 200,
    message: '更新订单成功',
    data: order
  };
  res.json(response);
});

router.put('/:id/status', (req: Request, res: Response) => {
  const operator = req.headers['x-operator'] as string || 'system';
  const { status, remark } = req.body;
  
  const order = orderService.updateStatus(req.params.id, status, operator, remark);

  if (!order) {
    const response: ApiResponse = {
      code: 404,
      message: '订单不存在'
    };
    return res.status(404).json(response);
  }

  const response: ApiResponse = {
    code: 200,
    message: '更新订单状态成功',
    data: order
  };
  res.json(response);
});

router.post('/:id/remark', (req: Request, res: Response) => {
  const operator = req.headers['x-operator'] as string || 'system';
  const { remark } = req.body;
  
  const success = orderService.addRemark(req.params.id, remark, operator);

  if (!success) {
    const response: ApiResponse = {
      code: 404,
      message: '订单不存在'
    };
    return res.status(404).json(response);
  }

  const response: ApiResponse = {
    code: 200,
    message: '添加备注成功'
  };
  res.json(response);
});

router.post('/:id/schedule-urgent', (req: Request, res: Response) => {
  const result = schedulingService.scheduleUrgentOrder(req.params.id);

  const response: ApiResponse = {
    code: result.success ? 200 : 400,
    message: result.message,
    data: result
  };
  res.json(response);
});

router.post('/:id/recall', (req: Request, res: Response) => {
  const operator = req.headers['x-operator'] as string || 'system';
  const { remark } = req.body;
  
  const success = schedulingService.recallOrder(req.params.id, remark || '用户撤回');

  if (!success) {
    const response: ApiResponse = {
      code: 400,
      message: '撤回失败，订单可能未排产或不存在'
    };
    return res.status(400).json(response);
  }

  const response: ApiResponse = {
    code: 200,
    message: '撤回成功'
  };
  res.json(response);
});

router.post('/:id/resubmit', (req: Request, res: Response) => {
  const result = schedulingService.resubmitOrder(req.params.id);

  const response: ApiResponse = {
    code: result.success ? 200 : 400,
    message: result.message,
    data: result
  };
  res.json(response);
});

router.post('/:id/manual-processing', (req: Request, res: Response) => {
  const operator = req.headers['x-operator'] as string || 'system';
  const { handler, remark } = req.body;
  
  const order = orderService.setManualProcessing(req.params.id, handler || operator, remark || '进入人工处理');

  if (!order) {
    const response: ApiResponse = {
      code: 404,
      message: '订单不存在'
    };
    return res.status(404).json(response);
  }

  const response: ApiResponse = {
    code: 200,
    message: '进入人工处理成功',
    data: order
  };
  res.json(response);
});

router.get('/capacity/verify/:ovenId/:date', (req: Request, res: Response) => {
  const result = schedulingService.verifyCapacityConsistency(req.params.ovenId, req.params.date);

  const response: ApiResponse = {
    code: 200,
    message: result.valid ? '产能校验通过' : '发现产能不一致',
    data: result
  };
  res.json(response);
});

export default router;