import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getState, setState, addHistory } from '../data/store';
import { findCandidates, getBestCandidate } from '../utils/dispatch';
import { Assignment, AssignmentStatus, OrderStatus } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { assignments } = getState();
  res.json({ success: true, data: assignments });
});

router.get('/order/:orderId', (req: Request, res: Response) => {
  const { assignments } = getState();
  const orderAssignments = assignments.filter(a => a.orderId === req.params.orderId);
  res.json({ success: true, data: orderAssignments });
});

router.get('/candidates/:orderId', (req: Request, res: Response) => {
  const { orders, aunts, leaves } = getState();
  const order = orders.find(o => o.id === req.params.orderId);
  
  if (!order) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  const candidates = findCandidates(order, aunts, leaves);
  
  res.json({ 
    success: true, 
    data: {
      order,
      candidates,
      hasValidCandidates: candidates.some(c => c.score > 0)
    }
  });
});

router.post('/', (req: Request, res: Response) => {
  const { orders, aunts, assignments, leaves } = getState();
  const { orderId, auntId } = req.body;
  
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  const aunt = aunts.find(a => a.id === auntId);
  if (!aunt) {
    return res.status(404).json({ success: false, error: '阿姨不存在' });
  }
  
  if (order.status !== 'pending_dispatch' && order.status !== 'reassigned') {
    return res.status(400).json({ 
      success: false, 
      error: `当前订单状态不允许派单，当前状态: ${order.status}` 
    });
  }
  
  const existingActiveAssignment = assignments.find(
    a => a.orderId === orderId && 
    ['pending', 'accepted', 'in_progress'].includes(a.status)
  );
  
  if (existingActiveAssignment) {
    return res.status(400).json({
      success: false,
      error: '该订单已有进行中的派单，无法重复派单'
    });
  }
  
  const candidate = getBestCandidate(order, [aunt], leaves);
  
  if (!candidate || candidate.score <= 0) {
    return res.status(400).json({
      success: false,
      error: '该阿姨不符合订单要求，无法派单'
    });
  }
  
  const now = new Date().toISOString();
  const newAssignment: Assignment = {
    id: `assign_${uuidv4()}`,
    orderId,
    auntId,
    status: 'pending',
    matchedSkills: candidate.matchedSkills,
    distanceKm: candidate.distanceKm,
    tabooConflicts: candidate.tabooConflicts,
    score: candidate.score,
    createdAt: now,
    updatedAt: now
  };
  
  setState({ assignments: [...assignments, newAssignment] });
  
  const orderIndex = orders.findIndex(o => o.id === orderId);
  const updatedOrders = [...orders];
  updatedOrders[orderIndex] = {
    ...updatedOrders[orderIndex],
    status: 'dispatched' as OrderStatus,
    updatedAt: now
  };
  setState({ orders: updatedOrders });
  
  addHistory({
    entityType: 'assignment',
    entityId: newAssignment.id,
    action: 'create',
    description: `派单: 订单 ${order.orderNo} 派给 ${aunt.name}`,
    newState: { ...newAssignment }
  });
  
  addHistory({
    entityType: 'order',
    entityId: orderId,
    action: 'dispatch',
    description: `订单 ${order.orderNo} 已派单给 ${aunt.name}`
  });
  
  res.json({ success: true, data: newAssignment });
});

router.put('/:id', (req: Request, res: Response) => {
  const { assignments, orders } = getState();
  const index = assignments.findIndex(a => a.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, error: '派单记录不存在' });
  }
  
  const assignment = assignments[index];
  const order = orders.find(o => o.id === assignment.orderId);
  
  const validStatusTransitions: Record<AssignmentStatus, AssignmentStatus[]> = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['in_progress', 'cancelled'],
    rejected: [],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: []
  };
  
  if (req.body.status && req.body.status !== assignment.status) {
    const validTransitions = validStatusTransitions[assignment.status];
    if (!validTransitions.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        error: `派单状态无法从 "${assignment.status}" 转换为 "${req.body.status}"`
      });
    }
  }
  
  const previousState = { ...assignment };
  const updatedAssignment: Assignment = {
    ...assignment,
    ...req.body,
    id: assignment.id,
    updatedAt: new Date().toISOString()
  };
  
  const newAssignments = [...assignments];
  newAssignments[index] = updatedAssignment;
  setState({ assignments: newAssignments });
  
  if (order) {
    const orderIndex = orders.findIndex(o => o.id === order.id);
    let newOrderStatus: OrderStatus = order.status;
    
    if (updatedAssignment.status === 'accepted') {
      newOrderStatus = 'dispatched';
    } else if (updatedAssignment.status === 'rejected') {
      newOrderStatus = 'reassigned';
    } else if (updatedAssignment.status === 'in_progress') {
      newOrderStatus = 'in_progress';
    } else if (updatedAssignment.status === 'completed') {
      newOrderStatus = 'completed';
    } else if (updatedAssignment.status === 'cancelled') {
      newOrderStatus = 'reassigned';
    }
    
    const updatedOrders = [...orders];
    updatedOrders[orderIndex] = {
      ...updatedOrders[orderIndex],
      status: newOrderStatus,
      updatedAt: new Date().toISOString()
    };
    setState({ orders: updatedOrders });
    
    addHistory({
      entityType: 'order',
      entityId: order.id,
      action: 'status_change',
      description: `订单 ${order.orderNo} 状态变更为 ${newOrderStatus}`
    });
  }
  
  addHistory({
    entityType: 'assignment',
    entityId: updatedAssignment.id,
    action: 'update',
    description: `更新派单状态: ${updatedAssignment.status}`,
    previousState,
    newState: { ...updatedAssignment }
  });
  
  res.json({ success: true, data: updatedAssignment });
});

export default router;
