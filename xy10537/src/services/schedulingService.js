const { 
  store, generateId, getTimestamp, addAuditLog,
  SCHEDULE_STATUS, LEAVE_STATUS, COMPENSATION_STATUS,
  checkIdempotency, setIdempotency
} = require('../data/models');

function createNanny(data, operator) {
  const idempotentKey = data.idempotentKey;
  if (idempotentKey) {
    const existing = checkIdempotency(`nanny:${idempotentKey}`);
    if (existing.exists) return existing.result;
  }

  const nanny = {
    id: generateId(),
    name: data.name,
    phone: data.phone,
    skills: data.skills || [],
    workArea: data.workArea,
    dailyCapacity: data.dailyCapacity || 2,
    rating: data.rating || 5,
    preferredNannyOf: data.preferredNannyOf || [],
    availability: data.availability || [],
    status: 'active',
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
    history: []
  };
  store.nannies.push(nanny);
  addAuditLog('nanny', nanny.id, 'create', null, nanny, operator, '创建阿姨档案');
  
  const result = { success: true, data: nanny };
  if (idempotentKey) setIdempotency(`nanny:${idempotentKey}`, result);
  return result;
}

function createSkill(data, operator) {
  const skill = {
    id: generateId(),
    name: data.name,
    description: data.description || '',
    category: data.category || 'general',
    createdAt: getTimestamp()
  };
  store.skills.push(skill);
  addAuditLog('skill', skill.id, 'create', null, skill, operator, '创建技能标签');
  return { success: true, data: skill };
}

function createOrder(data, operator) {
  const idempotentKey = data.idempotentKey;
  if (idempotentKey) {
    const existing = checkIdempotency(`order:${idempotentKey}`);
    if (existing.exists) return existing.result;
  }

  const order = {
    id: generateId(),
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerArea: data.customerArea,
    customerLocation: data.customerLocation,
    serviceType: data.serviceType,
    requiredSkills: data.requiredSkills || [],
    preferredNanny: data.preferredNanny || null,
    startTime: data.startTime,
    endTime: data.endTime,
    serviceDate: data.serviceDate,
    estimatedDuration: data.estimatedDuration || 120,
    status: 'pending_assignment',
    notes: data.notes || '',
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
    history: []
  };
  store.orders.push(order);
  addAuditLog('order', order.id, 'create', null, order, operator, '创建客户订单');
  
  const result = { success: true, data: order };
  if (idempotentKey) setIdempotency(`order:${idempotentKey}`, result);
  return result;
}

function calculateDistance(nannyArea, customerArea) {
  const distances = {
    '朝阳-海淀': 15,
    '海淀-朝阳': 15,
    '朝阳-东城': 8,
    '东城-朝阳': 8,
    '朝阳-西城': 10,
    '西城-朝阳': 10,
    '海淀-西城': 5,
    '西城-海淀': 5,
    '海淀-东城': 12,
    '东城-海淀': 12,
    '东城-西城': 3,
    '西城-东城': 3
  };
  
  if (nannyArea === customerArea) return 0;
  const key = `${nannyArea}-${customerArea}`;
  return distances[key] || 20;
}

function hasSkills(nanny, requiredSkills) {
  if (!requiredSkills || requiredSkills.length === 0) return true;
  return requiredSkills.every(skill => nanny.skills.includes(skill));
}

function isAvailable(nanny, startTime, endTime, serviceDate, excludeScheduleId = null) {
  const nannySchedules = store.schedules.filter(
    s => s.nannyId === nanny.id && 
         s.serviceDate === serviceDate &&
         s.status !== SCHEDULE_STATUS.CANCELLED &&
         s.id !== excludeScheduleId
  );

  for (const schedule of nannySchedules) {
    const overlap = (
      (startTime >= schedule.startTime && startTime < schedule.endTime) ||
      (endTime > schedule.startTime && endTime <= schedule.endTime) ||
      (startTime <= schedule.startTime && endTime >= schedule.endTime)
    );
    if (overlap) {
      return { available: false, conflict: schedule };
    }
  }

  const nannyLeaves = store.leaves.filter(
    l => l.nannyId === nanny.id && 
         l.status === LEAVE_STATUS.APPROVED &&
         l.date === serviceDate
  );

  if (nannyLeaves.length > 0) {
    return { available: false, leave: nannyLeaves[0] };
  }

  return { available: true };
}

function getDailyWorkCount(nanny, serviceDate, excludeScheduleId = null) {
  return store.schedules.filter(
    s => s.nannyId === nanny.id && 
         s.serviceDate === serviceDate &&
         s.status !== SCHEDULE_STATUS.CANCELLED &&
         s.id !== excludeScheduleId
  ).length;
}

function findBestNanny(order, excludeNannyId = null) {
  const candidates = [];
  const conflicts = [];

  for (const nanny of store.nannies) {
    if (nanny.status !== 'active') continue;
    if (excludeNannyId && nanny.id === excludeNannyId) continue;

    const issues = [];

    if (!hasSkills(nanny, order.requiredSkills)) {
      issues.push({ type: 'skill_mismatch', message: `缺少必需技能: ${order.requiredSkills.filter(s => !nanny.skills.includes(s)).join(', ')}` });
    }

    const distance = calculateDistance(nanny.workArea, order.customerArea);
    if (distance > 15) {
      issues.push({ type: 'distance_too_long', message: `跨区域路程过长: ${distance}公里` });
    }

    const availability = isAvailable(nanny, order.startTime, order.endTime, order.serviceDate);
    if (!availability.available) {
      if (availability.conflict) {
        issues.push({ 
          type: 'time_conflict', 
          message: `时间冲突: 已有排班 ${availability.conflict.id}`,
          conflictSchedule: availability.conflict
        });
      }
      if (availability.leave) {
        issues.push({ 
          type: 'on_leave', 
          message: `请假中: ${availability.leave.reason}`,
          leave: availability.leave
        });
      }
    }

    const dailyCount = getDailyWorkCount(nanny, order.serviceDate);
    if (dailyCount >= nanny.dailyCapacity) {
      issues.push({ type: 'capacity_exceeded', message: `每日接单量已达上限: ${nanny.dailyCapacity}` });
    }

    if (issues.length > 0) {
      conflicts.push({ nannyId: nanny.id, nannyName: nanny.name, issues });
      continue;
    }

    let score = 0;
    if (order.preferredNanny === nanny.id) score += 100;
    if (nanny.preferredNannyOf.includes(order.customerName)) score += 50;
    score += (nanny.rating || 0) * 10;
    score += (20 - distance);
    score += (nanny.dailyCapacity - dailyCount) * 5;

    candidates.push({ nanny, score, distance });
  }

  if (candidates.length === 0) {
    return { success: false, conflicts, reason: '没有符合条件的阿姨', reasonCode: 'no_eligible_nanny' };
  }

  candidates.sort((a, b) => b.score - a.score);
  return { success: true, best: candidates[0], alternates: candidates.slice(1), conflicts };
}

function createSchedule(orderId, operator, idempotentKey = null) {
  if (idempotentKey) {
    const existing = checkIdempotency(`schedule:${idempotentKey}`);
    if (existing.exists) return existing.result;
  }

  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: '订单不存在', errorCode: 'order_not_found' };
  }

  if (order.status !== 'pending_assignment') {
    return { success: false, error: '订单状态不是待分配', errorCode: 'invalid_order_status', currentStatus: order.status };
  }

  const result = findBestNanny(order);
  
  if (!result.success) {
    const schedule = {
      id: generateId(),
      orderId: orderId,
      nannyId: null,
      serviceDate: order.serviceDate,
      startTime: order.startTime,
      endTime: order.endTime,
      status: SCHEDULE_STATUS.CONFLICT,
      conflicts: result.conflicts,
      failReason: result.reason,
      failReasonCode: result.reasonCode,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
      history: [{
        action: 'assignment_failed',
        reason: result.reason,
        conflicts: result.conflicts,
        timestamp: getTimestamp(),
        operator
      }]
    };
    store.schedules.push(schedule);

    order.status = 'assignment_failed';
    order.updatedAt = getTimestamp();
    order.history.push({
      action: 'assignment_failed',
      reason: result.reason,
      timestamp: getTimestamp()
    });

    addAuditLog('schedule', schedule.id, 'create_failed', null, schedule, operator, result.reason);
    
    const finalResult = { 
      success: false, 
      data: schedule, 
      reason: result.reason,
      reasonCode: result.reasonCode,
      conflicts: result.conflicts
    };
    if (idempotentKey) setIdempotency(`schedule:${idempotentKey}`, finalResult);
    return finalResult;
  }

  const bestNanny = result.best.nanny;
  const distance = result.best.distance;

  const schedule = {
    id: generateId(),
    orderId: orderId,
    nannyId: bestNanny.id,
    nannyName: bestNanny.name,
    serviceDate: order.serviceDate,
    startTime: order.startTime,
    endTime: order.endTime,
    distance: distance,
    score: result.best.score,
    alternates: result.alternates.map(a => ({ 
      nannyId: a.nanny.id, 
      nannyName: a.nanny.name, 
      score: a.score,
      distance: a.distance
    })),
    status: SCHEDULE_STATUS.PENDING,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
    history: [{
      action: 'assigned',
      nannyId: bestNanny.id,
      nannyName: bestNanny.name,
      score: result.best.score,
      distance: distance,
      timestamp: getTimestamp(),
      operator
    }]
  };

  store.schedules.push(schedule);

  order.status = 'assigned';
  order.assignedNannyId = bestNanny.id;
  order.assignedNannyName = bestNanny.name;
  order.scheduleId = schedule.id;
  order.updatedAt = getTimestamp();
  order.history.push({
    action: 'nanny_assigned',
    nannyId: bestNanny.id,
    nannyName: bestNanny.name,
    timestamp: getTimestamp()
  });

  addAuditLog('schedule', schedule.id, 'create', null, schedule, operator, `分配阿姨: ${bestNanny.name}`);

  const finalResult = { success: true, data: schedule };
  if (idempotentKey) setIdempotency(`schedule:${idempotentKey}`, finalResult);
  return finalResult;
}

function advanceSchedule(scheduleId, targetStatus, operator, data = {}) {
  const schedule = store.schedules.find(s => s.id === scheduleId);
  if (!schedule) {
    return { success: false, error: '排班不存在', errorCode: 'schedule_not_found' };
  }

  const idempotentKey = data.idempotentKey;
  if (idempotentKey) {
    const existing = checkIdempotency(`advance:${idempotentKey}`);
    if (existing.exists) return existing.result;
  }

  const beforeStatus = schedule.status;
  let action;
  let reason;

  const statusTransitions = {
    [SCHEDULE_STATUS.PENDING]: [SCHEDULE_STATUS.CONFIRMED, SCHEDULE_STATUS.REJECTED, SCHEDULE_STATUS.CANCELLED, SCHEDULE_STATUS.NEEDS_REASSIGN],
    [SCHEDULE_STATUS.CONFIRMED]: [SCHEDULE_STATUS.IN_PROGRESS, SCHEDULE_STATUS.NEEDS_REASSIGN, SCHEDULE_STATUS.CANCELLED],
    [SCHEDULE_STATUS.IN_PROGRESS]: [SCHEDULE_STATUS.COMPLETED],
    [SCHEDULE_STATUS.NEEDS_REASSIGN]: [SCHEDULE_STATUS.REASSIGNED],
    [SCHEDULE_STATUS.CONFLICT]: [SCHEDULE_STATUS.NEEDS_REASSIGN],
    [SCHEDULE_STATUS.REASSIGNED]: [SCHEDULE_STATUS.CONFIRMED, SCHEDULE_STATUS.CANCELLED, SCHEDULE_STATUS.NEEDS_REASSIGN]
  };

  const validTransitions = statusTransitions[beforeStatus] || [];
  if (!validTransitions.includes(targetStatus)) {
    return { 
      success: false, 
      error: `状态流转不合法: ${beforeStatus} -> ${targetStatus}`, 
      errorCode: 'invalid_status_transition',
      validNextStates: validTransitions
    };
  }

  const before = JSON.parse(JSON.stringify(schedule));

  switch (targetStatus) {
    case SCHEDULE_STATUS.CONFIRMED:
      action = 'confirm';
      reason = '客户确认排班';
      schedule.confirmedAt = getTimestamp();
      break;

    case SCHEDULE_STATUS.REJECTED:
      action = 'reject';
      reason = data.reason || '客户拒绝';
      schedule.rejectedReason = reason;
      schedule.status = SCHEDULE_STATUS.NEEDS_REASSIGN;
      schedule.reassignCount = (schedule.reassignCount || 0) + 1;
      schedule.nextStatus = SCHEDULE_STATUS.NEEDS_REASSIGN;
      break;

    case SCHEDULE_STATUS.CANCELLED:
      action = 'cancel';
      reason = data.reason || '取消排班';
      schedule.cancelledReason = reason;
      schedule.cancelledAt = getTimestamp();
      break;

    case SCHEDULE_STATUS.IN_PROGRESS:
      action = 'start';
      reason = '服务开始';
      schedule.startedAt = getTimestamp();
      break;

    case SCHEDULE_STATUS.COMPLETED:
      action = 'complete';
      reason = '服务完成';
      schedule.completedAt = getTimestamp();
      break;

    case SCHEDULE_STATUS.NEEDS_REASSIGN:
      action = 'needs_reassign';
      reason = data.reason || '需要重新分配';
      schedule.reassignReason = reason;
      schedule.reassignCount = (schedule.reassignCount || 0) + 1;
      break;

    default:
      action = 'update';
      reason = '状态更新';
  }

  if (targetStatus !== SCHEDULE_STATUS.REJECTED) {
    schedule.status = targetStatus;
  }
  schedule.updatedAt = getTimestamp();
  schedule.history.push({
    action,
    fromStatus: beforeStatus,
    toStatus: targetStatus,
    reason,
    operator,
    timestamp: getTimestamp()
  });

  const order = store.orders.find(o => o.id === schedule.orderId);
  if (order) {
    order.updatedAt = getTimestamp();
    order.history.push({
      action: `schedule_${action}`,
      fromStatus: beforeStatus,
      toStatus: targetStatus,
      reason,
      timestamp: getTimestamp()
    });
  }

  addAuditLog('schedule', schedule.id, action, before, schedule, operator, reason);

  const result = { success: true, data: schedule, action, reason };
  if (idempotentKey) setIdempotency(`advance:${idempotentKey}`, result);
  return result;
}

function createLeave(data, operator) {
  const idempotentKey = data.idempotentKey;
  if (idempotentKey) {
    const existing = checkIdempotency(`leave:${idempotentKey}`);
    if (existing.exists) return existing.result;
  }

  const leave = {
    id: generateId(),
    nannyId: data.nannyId,
    nannyName: data.nannyName,
    date: data.date,
    startTime: data.startTime || '00:00',
    endTime: data.endTime || '23:59',
    reason: data.reason,
    status: LEAVE_STATUS.PENDING,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
    history: [{
      action: 'created',
      reason: data.reason,
      timestamp: getTimestamp(),
      operator
    }]
  };

  store.leaves.push(leave);
  addAuditLog('leave', leave.id, 'create', null, leave, operator, `创建请假: ${data.reason}`);

  const result = { success: true, data: leave };
  if (idempotentKey) setIdempotency(`leave:${idempotentKey}`, result);
  return result;
}

function approveLeave(leaveId, operator) {
  const leave = store.leaves.find(l => l.id === leaveId);
  if (!leave) {
    return { success: false, error: '请假不存在', errorCode: 'leave_not_found' };
  }

  if (leave.status !== LEAVE_STATUS.PENDING) {
    return { success: false, error: '请假状态不合法', errorCode: 'invalid_leave_status' };
  }

  const before = JSON.parse(JSON.stringify(leave));
  leave.status = LEAVE_STATUS.APPROVED;
  leave.approvedAt = getTimestamp();
  leave.updatedAt = getTimestamp();
  leave.history.push({
    action: 'approved',
    operator,
    timestamp: getTimestamp()
  });

  addAuditLog('leave', leave.id, 'approve', before, leave, operator, '批准请假');

  const affectedSchedules = store.schedules.filter(
    s => s.nannyId === leave.nannyId && 
         s.serviceDate === leave.date &&
         s.status !== SCHEDULE_STATUS.CANCELLED &&
         s.status !== SCHEDULE_STATUS.COMPLETED
  );

  const reassignments = [];
  for (const schedule of affectedSchedules) {
    const result = advanceSchedule(
      schedule.id, 
      SCHEDULE_STATUS.NEEDS_REASSIGN, 
      operator, 
      { reason: `阿姨 ${leave.nannyName} 请假: ${leave.reason}` }
    );
    if (result.success) {
      reassignments.push({
        scheduleId: schedule.id,
        orderId: schedule.orderId
      });
    }
  }

  return { 
    success: true, 
    data: leave, 
    affectedSchedules: reassignments.length,
    affectedScheduleDetails: reassignments
  };
}

function reassignSchedule(scheduleId, operator, data = {}) {
  const schedule = store.schedules.find(s => s.id === scheduleId);
  if (!schedule) {
    return { success: false, error: '排班不存在', errorCode: 'schedule_not_found' };
  }

  if (schedule.status !== SCHEDULE_STATUS.NEEDS_REASSIGN) {
    return { success: false, error: '排班状态不是待重新分配', errorCode: 'invalid_schedule_status' };
  }

  const order = store.orders.find(o => o.id === schedule.orderId);
  if (!order) {
    return { success: false, error: '关联订单不存在', errorCode: 'order_not_found' };
  }

  const idempotentKey = data.idempotentKey;
  if (idempotentKey) {
    const existing = checkIdempotency(`reassign:${idempotentKey}`);
    if (existing.exists) return existing.result;
  }

  const oldNannyId = schedule.nannyId;
  const result = findBestNanny(order, oldNannyId);

  const before = JSON.parse(JSON.stringify(schedule));

  if (!result.success) {
    schedule.status = SCHEDULE_STATUS.CONFLICT;
    schedule.conflicts = result.conflicts;
    schedule.failReason = result.reason;
    schedule.failReasonCode = result.reasonCode;
    schedule.updatedAt = getTimestamp();
    schedule.history.push({
      action: 'reassignment_failed',
      reason: result.reason,
      conflicts: result.conflicts,
      operator,
      timestamp: getTimestamp()
    });

    addAuditLog('schedule', schedule.id, 'reassign_failed', before, schedule, operator, result.reason);

    const finalResult = { 
      success: false, 
      data: schedule, 
      reason: result.reason,
      reasonCode: result.reasonCode,
      conflicts: result.conflicts
    };
    if (idempotentKey) setIdempotency(`reassign:${idempotentKey}`, finalResult);
    return finalResult;
  }

  const newNanny = result.best.nanny;
  const distance = result.best.distance;
  const isSameNanny = oldNannyId === newNanny.id;

  if (!isSameNanny) {
    const compensation = createCompensation({
      scheduleId: schedule.id,
      orderId: schedule.orderId,
      oldNannyId: oldNannyId,
      newNannyId: newNanny.id,
      reason: schedule.reassignReason || '临时换人',
      reassignCount: schedule.reassignCount || 1
    }, operator);

    schedule.compensationId = compensation.success ? compensation.data.id : null;
    schedule.lastCompensation = compensation.success ? compensation.data : null;
  }

  schedule.status = SCHEDULE_STATUS.REASSIGNED;
  schedule.previousNannies = schedule.previousNannies || [];
  if (oldNannyId) {
    schedule.previousNannies.push({
      nannyId: oldNannyId,
      nannyName: schedule.nannyName,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      replacedAt: getTimestamp(),
      reason: schedule.reassignReason
    });
  }

  schedule.nannyId = newNanny.id;
  schedule.nannyName = newNanny.name;
  schedule.distance = distance;
  schedule.latestScore = result.best.score;
  schedule.updatedAt = getTimestamp();
  schedule.history.push({
    action: 'reassigned',
    oldNannyId,
    oldNannyName: before.nannyName,
    newNannyId: newNanny.id,
    newNannyName: newNanny.name,
    isSameNanny,
    reason: schedule.reassignReason,
    operator,
    timestamp: getTimestamp()
  });

  order.assignedNannyId = newNanny.id;
  order.assignedNannyName = newNanny.name;
  order.reassignCount = (order.reassignCount || 0) + 1;
  order.updatedAt = getTimestamp();
  order.history.push({
    action: 'nanny_reassigned',
    oldNannyId,
    newNannyId: newNanny.id,
    newNannyName: newNanny.name,
    timestamp: getTimestamp()
  });

  addAuditLog('schedule', schedule.id, 'reassign', before, schedule, operator, `换人: ${before.nannyName || '无'} -> ${newNanny.name}`);

  const finalResult = { 
    success: true, 
    data: schedule, 
    isSameNanny,
    compensationCreated: !isSameNanny
  };
  if (idempotentKey) setIdempotency(`reassign:${idempotentKey}`, finalResult);
  return finalResult;
}

function createCompensation(data, operator) {
  const reassignCount = data.reassignCount || 1;
  const baseAmount = 50;
  const amount = baseAmount + (reassignCount - 1) * 25;

  const compensation = {
    id: generateId(),
    scheduleId: data.scheduleId,
    orderId: data.orderId,
    oldNannyId: data.oldNannyId,
    newNannyId: data.newNannyId,
    reason: data.reason,
    reassignCount,
    amount,
    status: COMPENSATION_STATUS.PENDING,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
    history: [{
      action: 'created',
      reason: data.reason,
      amount,
      operator,
      timestamp: getTimestamp()
    }]
  };

  store.compensations.push(compensation);
  addAuditLog('compensation', compensation.id, 'create', null, compensation, operator, `创建换人补偿: ¥${amount}`);

  return { success: true, data: compensation };
}

function getSchedule(scheduleId) {
  const schedule = store.schedules.find(s => s.id === scheduleId);
  if (!schedule) {
    return { success: false, error: '排班不存在', errorCode: 'schedule_not_found' };
  }

  const order = store.orders.find(o => o.id === schedule.orderId);
  const compensations = store.compensations.filter(c => c.scheduleId === scheduleId);
  const auditLogs = store.auditLogs.filter(l => l.entityType === 'schedule' && l.entityId === scheduleId);

  return {
    success: true,
    data: {
      schedule,
      order: order || null,
      compensations,
      auditLogs,
      history: schedule.history
    }
  };
}

function getDailySchedules(date) {
  const schedules = store.schedules.filter(s => s.serviceDate === date);
  const ordersMap = {};
  store.orders.forEach(o => { ordersMap[o.id] = o; });

  const grouped = {
    date,
    total: schedules.length,
    byStatus: {},
    schedules: schedules.map(s => ({
      ...s,
      order: ordersMap[s.orderId] || null,
      conflicts: s.conflicts || []
    }))
  };

  schedules.forEach(s => {
    grouped.byStatus[s.status] = (grouped.byStatus[s.status] || 0) + 1;
  });

  const conflicts = schedules.filter(s => s.status === SCHEDULE_STATUS.CONFLICT).map(s => ({
    scheduleId: s.id,
    orderId: s.orderId,
    failReason: s.failReason,
    failReasonCode: s.failReasonCode,
    conflicts: s.conflicts
  }));

  const needsReassign = schedules.filter(s => s.status === SCHEDULE_STATUS.NEEDS_REASSIGN).map(s => ({
    scheduleId: s.id,
    orderId: s.orderId,
    reassignReason: s.reassignReason,
    reassignCount: s.reassignCount
  }));

  grouped.conflicts = conflicts;
  grouped.needsReassign = needsReassign;

  return { success: true, data: grouped };
}

function getReassignHistory(orderId) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: '订单不存在', errorCode: 'order_not_found' };
  }

  const schedules = store.schedules.filter(s => s.orderId === orderId);
  const compensations = store.compensations.filter(c => c.orderId === orderId);

  const allChanges = [];

  schedules.forEach(schedule => {
    if (schedule.previousNannies) {
      schedule.previousNannies.forEach(prev => {
        allChanges.push({
          type: 'nanny_change',
          scheduleId: schedule.id,
          from: { nannyId: prev.nannyId, nannyName: prev.nannyName },
          to: { nannyId: schedule.nannyId, nannyName: schedule.nannyName },
          reason: prev.reason,
          timestamp: prev.replacedAt
        });
      });
    }

    schedule.history.forEach(h => {
      if (h.action === 'rejected' || h.action === 'needs_reassign') {
        allChanges.push({
          type: 'schedule_change',
          scheduleId: schedule.id,
          action: h.action,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          reason: h.reason,
          timestamp: h.timestamp
        });
      }
    });
  });

  allChanges.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return {
    success: true,
    data: {
      order,
      totalChanges: allChanges.length,
      totalReassigns: schedules.filter(s => s.reassignCount).reduce((sum, s) => sum + (s.reassignCount || 0), 0),
      totalCompensations: compensations.length,
      totalCompensationAmount: compensations.reduce((sum, c) => sum + c.amount, 0),
      changes: allChanges,
      compensations
    }
  };
}

function getCustomerImpact(orderId) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: '订单不存在', errorCode: 'order_not_found' };
  }

  const schedules = store.schedules.filter(s => s.orderId === orderId);
  const compensations = store.compensations.filter(c => c.orderId === orderId);

  const reassignCount = schedules.filter(s => s.reassignCount).reduce((sum, s) => sum + (s.reassignCount || 0), 0);
  const rejectedCount = schedules.filter(s => 
    s.history.some(h => h.action === 'reject')
  ).length;

  const impact = {
    orderId,
    customerName: order.customerName,
    serviceDate: order.serviceDate,
    originalAssignment: null,
    currentAssignment: null,
    reassignCount,
    rejectedCount,
    compensationCount: compensations.length,
    compensationAmount: compensations.reduce((sum, c) => sum + c.amount, 0),
    satisfactionLevel: 'high',
    issues: []
  };

  for (const schedule of schedules) {
    if (schedule.previousNannies && schedule.previousNannies.length > 0) {
      const first = schedule.previousNannies[0];
      impact.originalAssignment = {
        nannyId: first.nannyId,
        nannyName: first.nannyName
      };
    }
    if (schedule.status !== SCHEDULE_STATUS.CANCELLED) {
      impact.currentAssignment = {
        nannyId: schedule.nannyId,
        nannyName: schedule.nannyName,
        status: schedule.status
      };
    }
  }

  if (reassignCount > 2) {
    impact.issues.push('多次换人，影响客户体验');
    impact.satisfactionLevel = 'low';
  } else if (reassignCount > 0) {
    impact.issues.push('存在换人情况');
    impact.satisfactionLevel = 'medium';
  }

  if (rejectedCount > 0) {
    impact.issues.push('客户有拒绝记录');
    impact.satisfactionLevel = impact.satisfactionLevel === 'high' ? 'medium' : impact.satisfactionLevel;
  }

  return { success: true, data: impact };
}

function exportReport(date) {
  const dailyResult = getDailySchedules(date);
  if (!dailyResult.success) return dailyResult;

  const daily = dailyResult.data;
  const orderIds = daily.schedules.map(s => s.orderId);
  const uniqueOrderIds = [...new Set(orderIds)];

  const customerImpacts = [];
  for (const orderId of uniqueOrderIds) {
    const impactResult = getCustomerImpact(orderId);
    if (impactResult.success) {
      customerImpacts.push(impactResult.data);
    }
  }

  const allCompensations = store.compensations.filter(
    c => daily.schedules.some(s => s.id === c.scheduleId)
  );

  const reassignHistories = [];
  for (const orderId of uniqueOrderIds) {
    const historyResult = getReassignHistory(orderId);
    if (historyResult.success && historyResult.data.totalChanges > 0) {
      reassignHistories.push(historyResult.data);
    }
  }

  const report = {
    reportDate: date,
    generatedAt: getTimestamp(),
    summary: {
      totalSchedules: daily.total,
      byStatus: daily.byStatus,
      conflictCount: daily.conflicts.length,
      needsReassignCount: daily.needsReassign.length,
      totalCompensations: allCompensations.length,
      totalCompensationAmount: allCompensations.reduce((sum, c) => sum + c.amount, 0),
      affectedCustomers: customerImpacts.filter(i => i.issues.length > 0).length
    },
    dailySchedules: daily,
    customerImpacts,
    reassignHistories,
    compensations: allCompensations,
    conflictDetails: daily.conflicts
  };

  return { success: true, data: report };
}

function manualCorrect(scheduleId, newNannyId, operator, reason) {
  const schedule = store.schedules.find(s => s.id === scheduleId);
  if (!schedule) {
    return { success: false, error: '排班不存在', errorCode: 'schedule_not_found' };
  }

  const newNanny = store.nannies.find(n => n.id === newNannyId);
  if (!newNanny) {
    return { success: false, error: '目标阿姨不存在', errorCode: 'nanny_not_found' };
  }

  const before = JSON.parse(JSON.stringify(schedule));
  const oldNannyId = schedule.nannyId;

  const order = store.orders.find(o => o.id === schedule.orderId);

  schedule.previousNannies = schedule.previousNannies || [];
  if (oldNannyId) {
    schedule.previousNannies.push({
      nannyId: oldNannyId,
      nannyName: schedule.nannyName,
      replacedAt: getTimestamp(),
      reason: `人工修正: ${reason}`
    });
  }

  schedule.nannyId = newNannyId;
  schedule.nannyName = newNanny.name;
  schedule.manuallyCorrected = true;
  schedule.manualCorrectReason = reason;
  schedule.updatedAt = getTimestamp();
  schedule.history.push({
    action: 'manual_correct',
    oldNannyId,
    oldNannyName: before.nannyName,
    newNannyId,
    newNannyName: newNanny.name,
    operator,
    reason,
    timestamp: getTimestamp()
  });

  if (order) {
    order.assignedNannyId = newNannyId;
    order.assignedNannyName = newNanny.name;
    order.updatedAt = getTimestamp();
  }

  addAuditLog('schedule', schedule.id, 'manual_correct', before, schedule, operator, reason);

  return {
    success: true,
    data: schedule,
    diff: {
      before: {
        nannyId: oldNannyId,
        nannyName: before.nannyName,
        status: before.status
      },
      after: {
        nannyId: newNannyId,
        nannyName: newNanny.name,
        status: schedule.status
      }
    }
  };
}

function getAuditLogs(entityType = null, entityId = null) {
  let logs = [...store.auditLogs];
  
  if (entityType) {
    logs = logs.filter(l => l.entityType === entityType);
  }
  if (entityId) {
    logs = logs.filter(l => l.entityId === entityId);
  }

  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return { success: true, data: logs };
}

function getAllNannies() {
  return { success: true, data: store.nannies };
}

function getAllOrders() {
  return { success: true, data: store.orders };
}

function getAllSkills() {
  return { success: true, data: store.skills };
}

function getAllLeaves() {
  return { success: true, data: store.leaves };
}

function getAllCompensations() {
  return { success: true, data: store.compensations };
}

module.exports = {
  createNanny,
  createSkill,
  createOrder,
  createSchedule,
  advanceSchedule,
  createLeave,
  approveLeave,
  reassignSchedule,
  createCompensation,
  getSchedule,
  getDailySchedules,
  getReassignHistory,
  getCustomerImpact,
  exportReport,
  manualCorrect,
  getAuditLogs,
  getAllNannies,
  getAllOrders,
  getAllSkills,
  getAllLeaves,
  getAllCompensations,
  findBestNanny,
  SCHEDULE_STATUS,
  LEAVE_STATUS,
  COMPENSATION_STATUS
};
