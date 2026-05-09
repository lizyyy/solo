import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getState, setState, addHistory } from '../data/store';
import { Leave, OrderStatus } from '../types';

const router = Router();

const findAffectedOrders = (
  auntId: string,
  startTime: string,
  endTime: string
): string[] => {
  const { orders, assignments } = getState();
  const leaveStart = new Date(startTime).getTime();
  const leaveEnd = new Date(endTime).getTime();
  
  const affectedAssignmentOrderIds = assignments
    .filter(a => 
      a.auntId === auntId && 
      ['pending', 'accepted', 'in_progress'].includes(a.status)
    )
    .map(a => a.orderId);
  
  return orders
    .filter(o => {
      if (!affectedAssignmentOrderIds.includes(o.id)) return false;
      
      const orderStart = new Date(o.startTime).getTime();
      const orderEnd = new Date(o.endTime).getTime();
      
      return (orderStart < leaveEnd && orderEnd > leaveStart);
    })
    .map(o => o.id);
};

router.get('/', (req: Request, res: Response) => {
  const { leaves } = getState();
  res.json({ success: true, data: leaves });
});

router.get('/aunt/:auntId', (req: Request, res: Response) => {
  const { leaves } = getState();
  const auntLeaves = leaves.filter(l => l.auntId === req.params.auntId);
  res.json({ success: true, data: auntLeaves });
});

router.post('/', (req: Request, res: Response) => {
  const { leaves, aunts } = getState();
  const { auntId, startTime, endTime, reason } = req.body;
  
  const aunt = aunts.find(a => a.id === auntId);
  if (!aunt) {
    return res.status(404).json({ success: false, error: '阿姨不存在' });
  }
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  if (start >= end) {
    return res.status(400).json({
      success: false,
      error: '结束时间必须晚于开始时间'
    });
  }
  
  const conflictingLeave = leaves.find(l => {
    if (l.auntId !== auntId || !l.isApproved) return false;
    const lStart = new Date(l.startTime).getTime();
    const lEnd = new Date(l.endTime).getTime();
    const reqStart = start.getTime();
    const reqEnd = end.getTime();
    return (reqStart < lEnd && reqEnd > lStart);
  });
  
  if (conflictingLeave) {
    return res.status(400).json({
      success: false,
      error: '该时间段已有请假申请'
    });
  }
  
  const affectedOrders = findAffectedOrders(auntId, startTime, endTime);
  
  const now = new Date().toISOString();
  const newLeave: Leave = {
    id: `leave_${uuidv4()}`,
    auntId,
    startTime,
    endTime,
    reason,
    isApproved: false,
    affectedOrders,
    createdAt: now,
    updatedAt: now
  };
  
  setState({ leaves: [...leaves, newLeave] });
  
  addHistory({
    entityType: 'leave',
    entityId: newLeave.id,
    action: 'create',
    description: `阿姨 ${aunt.name} 申请请假: ${reason}`,
    newState: { ...newLeave }
  });
  
  res.json({ 
    success: true, 
    data: {
      ...newLeave,
      warning: affectedOrders.length > 0 
        ? `该请假将影响 ${affectedOrders.length} 个订单，请及时处理` 
        : null
    }
  });
});

router.put('/:id/approve', (req: Request, res: Response) => {
  const { leaves, orders, assignments, aunts } = getState();
  const index = leaves.findIndex(l => l.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, error: '请假记录不存在' });
  }
  
  const leave = leaves[index];
  const aunt = aunts.find(a => a.id === leave.auntId);
  
  if (leave.isApproved) {
    return res.status(400).json({ success: false, error: '该请假已批准' });
  }
  
  const now = new Date().toISOString();
  const updatedLeave: Leave = {
    ...leave,
    isApproved: true,
    updatedAt: now
  };
  
  const newLeaves = [...leaves];
  newLeaves[index] = updatedLeave;
  setState({ leaves: newLeaves });
  
  const reassignedOrders: string[] = [];
  const updatedAssignments = assignments.map(a => {
    if (
      a.auntId === leave.auntId &&
      ['pending', 'accepted', 'in_progress'].includes(a.status)
    ) {
      const order = orders.find(o => o.id === a.orderId);
      if (order) {
        const orderStart = new Date(order.startTime).getTime();
        const orderEnd = new Date(order.endTime).getTime();
        const leaveStart = new Date(leave.startTime).getTime();
        const leaveEnd = new Date(leave.endTime).getTime();
        
        if (orderStart < leaveEnd && orderEnd > leaveStart) {
          reassignedOrders.push(order.id);
          addHistory({
            entityType: 'assignment',
            entityId: a.id,
            action: 'cancel',
            description: `因阿姨请假，派单已取消，需要重新派单`
          });
          return { ...a, status: 'cancelled' as const, updatedAt: now };
        }
      }
    }
    return a;
  });
  setState({ assignments: updatedAssignments });
  
  const updatedOrders = orders.map(o => {
    if (reassignedOrders.includes(o.id)) {
      addHistory({
        entityType: 'order',
        entityId: o.id,
        action: 'reassign',
        description: `因阿姨请假，订单需要重新派单`
      });
      return { ...o, status: 'reassigned' as OrderStatus, updatedAt: now };
    }
    return o;
  });
  setState({ orders: updatedOrders });
  
  addHistory({
    entityType: 'leave',
    entityId: updatedLeave.id,
    action: 'approve',
    description: `批准 ${aunt?.name || '阿姨'} 的请假申请${
      reassignedOrders.length > 0 
        ? `，影响 ${reassignedOrders.length} 个订单` 
        : ''
    }`,
    newState: { ...updatedLeave }
  });
  
  res.json({ 
    success: true, 
    data: {
      ...updatedLeave,
      affectedOrders: reassignedOrders
    }
  });
});

router.put('/:id/reject', (req: Request, res: Response) => {
  const { leaves, aunts } = getState();
  const index = leaves.findIndex(l => l.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, error: '请假记录不存在' });
  }
  
  const leave = leaves[index];
  const aunt = aunts.find(a => a.id === leave.auntId);
  
  if (leave.isApproved) {
    return res.status(400).json({ success: false, error: '已批准的请假无法拒绝' });
  }
  
  const now = new Date().toISOString();
  const updatedLeave: Leave = {
    ...leave,
    isApproved: false,
    updatedAt: now
  };
  
  const newLeaves = [...leaves];
  newLeaves[index] = updatedLeave;
  setState({ leaves: newLeaves });
  
  addHistory({
    entityType: 'leave',
    entityId: updatedLeave.id,
    action: 'reject',
    description: `拒绝 ${aunt?.name || '阿姨'} 的请假申请`,
    newState: { ...updatedLeave }
  });
  
  res.json({ success: true, data: updatedLeave });
});

export default router;
