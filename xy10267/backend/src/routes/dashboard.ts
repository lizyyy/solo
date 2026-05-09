import { Router, Request, Response } from 'express';
import { getState } from '../data/store';
import { OrderStatus, AssignmentStatus } from '../types';

const router = Router();

router.get('/stats', (req: Request, res: Response) => {
  const { aunts, orders, assignments, leaves } = getState();
  
  const orderStats: Record<OrderStatus, number> = {
    pending_dispatch: 0,
    dispatched: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    reassigned: 0
  };
  
  orders.forEach(o => {
    orderStats[o.status]++;
  });
  
  const assignmentStats: Record<AssignmentStatus, number> = {
    pending: 0,
    accepted: 0,
    rejected: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0
  };
  
  assignments.forEach(a => {
    assignmentStats[a.status]++;
  });
  
  const pendingLeaves = leaves.filter(l => !l.isApproved).length;
  const approvedLeaves = leaves.filter(l => l.isApproved).length;
  
  const availableAunts = aunts.filter(a => a.isAvailable).length;
  const totalAunts = aunts.length;
  
  const avgDistance = assignments.length > 0
    ? assignments.reduce((sum, a) => sum + a.distanceKm, 0) / assignments.length
    : 0;
  
  const avgScore = assignments.length > 0
    ? assignments.reduce((sum, a) => sum + a.score, 0) / assignments.length
    : 0;
  
  const blockedPoints = {
    pendingDispatch: orderStats.pending_dispatch,
    pendingLeaves,
    reassignedOrders: orderStats.reassigned,
    pendingAssignments: assignmentStats.pending
  };
  
  const suggestions = [];
  
  if (blockedPoints.pendingDispatch > 3) {
    suggestions.push({
      priority: 'high',
      type: 'dispatch',
      message: `有 ${blockedPoints.pendingDispatch} 个订单待派单，请及时处理`,
      action: '前往订单列表查看待派单订单'
    });
  }
  
  if (blockedPoints.reassignedOrders > 0) {
    suggestions.push({
      priority: 'high',
      type: 'reassign',
      message: `有 ${blockedPoints.reassignedOrders} 个订单需要重新派单`,
      action: '查看转派订单并重新匹配阿姨'
    });
  }
  
  if (blockedPoints.pendingLeaves > 0) {
    suggestions.push({
      priority: 'medium',
      type: 'leave',
      message: `有 ${blockedPoints.pendingLeaves} 个请假申请待审批`,
      action: '审批请假申请'
    });
  }
  
  if (availableAunts < totalAunts * 0.5) {
    suggestions.push({
      priority: 'medium',
      type: 'availability',
      message: `可用阿姨不足 50% (${availableAunts}/${totalAunts})`,
      action: '检查阿姨可用性'
    });
  }
  
  res.json({
    success: true,
    data: {
      totals: {
        aunts: totalAunts,
        availableAunts,
        orders: orders.length,
        assignments: assignments.length,
        leaves: leaves.length
      },
      orderStats,
      assignmentStats,
      leaveStats: {
        pending: pendingLeaves,
        approved: approvedLeaves
      },
      quality: {
        avgDistance: avgDistance.toFixed(2),
        avgScore: avgScore.toFixed(2)
      },
      blockedPoints,
      suggestions
    }
  });
});

router.get('/blocked-orders', (req: Request, res: Response) => {
  const { orders, assignments, aunts, leaves } = getState();
  
  const blockedOrders = orders.filter(o => 
    ['pending_dispatch', 'reassigned'].includes(o.status)
  ).map(order => {
    const relatedAssignments = assignments.filter(a => a.orderId === order.id);
    
    return {
      order,
      assignments: relatedAssignments,
      blockReason: order.status === 'pending_dispatch' 
        ? '待派单' 
        : '需要重新派单（可能是阿姨请假或拒绝）',
      suggestedAction: order.status === 'pending_dispatch'
        ? '查看候选阿姨并派单'
        : '重新匹配阿姨'
    };
  });
  
  res.json({ success: true, data: blockedOrders });
});

export default router;
