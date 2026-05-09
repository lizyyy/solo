import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getState, setState, addHistory } from '../data/store';
import { Order, OrderStatus } from '../types';

const router = Router();

const generateOrderNo = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `HK${year}${month}${day}${random}`;
};

router.get('/', (req: Request, res: Response) => {
  const { orders } = getState();
  res.json({ success: true, data: orders });
});

router.get('/:id', (req: Request, res: Response) => {
  const { orders } = getState();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  res.json({ success: true, data: order });
});

router.post('/', (req: Request, res: Response) => {
  const { orders, customers } = getState();
  
  if (!req.body.source || req.body.source.trim() === '') {
    return res.status(400).json({
      success: false,
      error: '订单来源不能为空，请填写订单来源（如：线上平台、线下门店、老客户转介绍等）'
    });
  }
  
  const customer = customers.find(c => c.id === req.body.customerId);
  if (!customer) {
    return res.status(400).json({
      success: false,
      error: '客户不存在，请先创建客户信息'
    });
  }
  
  const startTime = new Date(req.body.startTime);
  const endTime = new Date(req.body.endTime);
  
  if (startTime >= endTime) {
    return res.status(400).json({
      success: false,
      error: '结束时间必须晚于开始时间'
    });
  }
  
  const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  
  if (!req.body.skillsRequired || req.body.skillsRequired.length === 0) {
    return res.status(400).json({
      success: false,
      error: '请至少选择一项所需技能'
    });
  }
  
  const now = new Date().toISOString();
  const newOrder: Order = {
    id: `order_${uuidv4()}`,
    orderNo: generateOrderNo(),
    customerId: req.body.customerId,
    skillsRequired: req.body.skillsRequired,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    durationHours: Math.round(durationHours * 10) / 10,
    location: req.body.location || customer.location,
    customerTaboos: req.body.customerTaboos || customer.taboos || [],
    specialRequirements: req.body.specialRequirements,
    status: 'pending_dispatch',
    source: req.body.source,
    createdAt: now,
    updatedAt: now
  };
  
  setState({ orders: [...orders, newOrder] });
  addHistory({
    entityType: 'order',
    entityId: newOrder.id,
    action: 'create',
    description: `创建新订单: ${newOrder.orderNo}`,
    newState: { ...newOrder }
  });
  
  res.json({ success: true, data: newOrder });
});

router.put('/:id', (req: Request, res: Response) => {
  const { orders } = getState();
  const index = orders.findIndex(o => o.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  const order = orders[index];
  
  const validStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
    pending_dispatch: ['dispatched', 'cancelled'],
    dispatched: ['in_progress', 'cancelled', 'reassigned'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    reassigned: ['dispatched', 'in_progress', 'cancelled']
  };
  
  if (req.body.status && req.body.status !== order.status) {
    const validTransitions = validStatusTransitions[order.status];
    if (!validTransitions.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        error: `订单状态无法从 "${order.status}" 转换为 "${req.body.status}"`
      });
    }
  }
  
  const previousState = { ...order };
  const updatedOrder: Order = {
    ...order,
    ...req.body,
    id: order.id,
    updatedAt: new Date().toISOString()
  };
  
  const newOrders = [...orders];
  newOrders[index] = updatedOrder;
  setState({ orders: newOrders });
  
  addHistory({
    entityType: 'order',
    entityId: updatedOrder.id,
    action: 'update',
    description: `更新订单: ${updatedOrder.orderNo}`,
    previousState,
    newState: { ...updatedOrder }
  });
  
  res.json({ success: true, data: updatedOrder });
});

router.delete('/:id', (req: Request, res: Response) => {
  const { orders, assignments } = getState();
  const order = orders.find(o => o.id === req.params.id);
  
  if (!order) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  const relatedAssignments = assignments.filter(a => a.orderId === order.id);
  if (relatedAssignments.length > 0) {
    return res.status(400).json({
      success: false,
      error: '该订单已有派单记录，无法删除'
    });
  }
  
  setState({ orders: orders.filter(o => o.id !== req.params.id) });
  
  addHistory({
    entityType: 'order',
    entityId: req.params.id,
    action: 'delete',
    description: `删除订单: ${order.orderNo}`
  });
  
  res.json({ success: true, message: '删除成功' });
});

export default router;
