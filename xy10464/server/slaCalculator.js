const {
  differenceInMilliseconds,
  parseISO,
  format,
  addHours
} = require('date-fns');

const { db } = require('./database');

const EVENT_TYPES = {
  CREATED: 'created',
  RESPONDED: 'responded',
  PAUSED: 'paused',
  RESUMED: 'resumed',
  REPAIRED: 'repaired',
  CLOSED: 'closed'
};

function getTimelineForWorkOrder(workOrderId) {
  const events = db.prepare(`
    SELECT * FROM timing_events 
    WHERE work_order_id = ? 
    ORDER BY event_time ASC
  `).all(workOrderId);
  
  return events;
}

function getWorkOrderWithContract(workOrderId) {
  const workOrder = db.prepare(`
    SELECT wo.*, c.* 
    FROM work_orders wo
    JOIN contracts c ON wo.contract_id = c.id
    WHERE wo.id = ?
  `).get(workOrderId);
  
  return workOrder;
}

function calculateTotalPausedTime(events) {
  let totalPausedMs = 0;
  let pausedStart = null;
  
  for (const event of events) {
    if (event.event_type === EVENT_TYPES.PAUSED) {
      pausedStart = parseISO(event.event_time);
    } else if (event.event_type === EVENT_TYPES.RESUMED && pausedStart) {
      const resumedTime = parseISO(event.event_time);
      totalPausedMs += differenceInMilliseconds(resumedTime, pausedStart);
      pausedStart = null;
    }
  }
  
  return totalPausedMs;
}

function getPausedPeriods(events) {
  const periods = [];
  let currentPeriod = null;
  
  for (const event of events) {
    if (event.event_type === EVENT_TYPES.PAUSED) {
      currentPeriod = {
        start: event.event_time,
        startEvent: event,
        end: null,
        endEvent: null,
        reason: event.reason,
        evidence_url: event.evidence_url
      };
    } else if (event.event_type === EVENT_TYPES.RESUMED && currentPeriod) {
      currentPeriod.end = event.event_time;
      currentPeriod.endEvent = event;
      
      const start = parseISO(currentPeriod.start);
      const end = parseISO(currentPeriod.end);
      currentPeriod.durationMs = differenceInMilliseconds(end, start);
      currentPeriod.durationHours = currentPeriod.durationMs / (1000 * 60 * 60);
      
      periods.push(currentPeriod);
      currentPeriod = null;
    }
  }
  
  if (currentPeriod) {
    currentPeriod.durationMs = differenceInMilliseconds(new Date(), parseISO(currentPeriod.start));
    currentPeriod.durationHours = currentPeriod.durationMs / (1000 * 60 * 60);
    periods.push(currentPeriod);
  }
  
  return periods;
}

function findEvent(events, type) {
  return events.find(e => e.event_type === type);
}

function calculateSLA(workOrderId, options = {}) {
  const workOrder = getWorkOrderWithContract(workOrderId);
  if (!workOrder) {
    return { error: '工单不存在' };
  }
  
  const events = getTimelineForWorkOrder(workOrderId);
  const pausedPeriods = getPausedPeriods(events);
  const totalPausedMs = calculateTotalPausedTime(events);
  
  const createdEvent = findEvent(events, EVENT_TYPES.CREATED);
  const respondedEvent = findEvent(events, EVENT_TYPES.RESPONDED);
  const repairedEvent = findEvent(events, EVENT_TYPES.REPAIRED);
  
  if (!createdEvent) {
    return { error: '工单缺少创建时间事件' };
  }
  
  const result = {
    workOrderId,
    contract: {
      responseSlaHours: workOrder.response_sla_hours,
      repairSlaHours: workOrder.repair_sla_hours,
      responseFineRate: workOrder.response_fine_rate,
      repairFineRate: workOrder.repair_fine_rate,
      maxResponseFine: workOrder.max_response_fine,
      maxRepairFine: workOrder.max_repair_fine,
      maxTotalFine: workOrder.max_total_fine
    },
    events,
    pausedPeriods,
    totalPausedMs,
    totalPausedHours: totalPausedMs / (1000 * 60 * 60),
    responseSla: null,
    repairSla: null,
    exemptionRequests: [],
    totalFine: 0,
    approvedExemptionAmount: 0,
    netFine: 0
  };
  
  if (respondedEvent) {
    const startTime = parseISO(createdEvent.event_time);
    const responseTime = parseISO(respondedEvent.event_time);
    
    const rawResponseMs = differenceInMilliseconds(responseTime, startTime);
    const adjustedResponseMs = rawResponseMs - totalPausedMs;
    const adjustedResponseHours = adjustedResponseMs / (1000 * 60 * 60);
    
    let responseOverdueHours = 0;
    if (adjustedResponseHours > workOrder.response_sla_hours) {
      responseOverdueHours = adjustedResponseHours - workOrder.response_sla_hours;
    }
    
    let responseFine = responseOverdueHours * workOrder.response_fine_rate;
    if (workOrder.max_response_fine !== null && responseFine > workOrder.max_response_fine) {
      responseFine = workOrder.max_response_fine;
    }
    
    result.responseSla = {
      startTime: createdEvent.event_time,
      responseTime: respondedEvent.event_time,
      rawResponseMs,
      rawResponseHours: rawResponseMs / (1000 * 60 * 60),
      adjustedResponseMs,
      adjustedResponseHours,
      slaHours: workOrder.response_sla_hours,
      overdueHours: responseOverdueHours,
      fine: responseFine,
      deadline: format(addHours(startTime, workOrder.response_sla_hours), 'yyyy-MM-dd HH:mm:ss')
    };
  }
  
  if (repairedEvent && respondedEvent) {
    const startTime = parseISO(respondedEvent.event_time);
    const repairTime = parseISO(repairedEvent.event_time);
    
    const rawRepairMs = differenceInMilliseconds(repairTime, startTime);
    const adjustedRepairMs = rawRepairMs - totalPausedMs;
    const adjustedRepairHours = adjustedRepairMs / (1000 * 60 * 60);
    
    let repairOverdueHours = 0;
    if (adjustedRepairHours > workOrder.repair_sla_hours) {
      repairOverdueHours = adjustedRepairHours - workOrder.repair_sla_hours;
    }
    
    let repairFine = repairOverdueHours * workOrder.repair_fine_rate;
    if (workOrder.max_repair_fine !== null && repairFine > workOrder.max_repair_fine) {
      repairFine = workOrder.max_repair_fine;
    }
    
    result.repairSla = {
      startTime: respondedEvent.event_time,
      repairTime: repairedEvent.event_time,
      rawRepairMs,
      rawRepairHours: rawRepairMs / (1000 * 60 * 60),
      adjustedRepairMs,
      adjustedRepairHours,
      slaHours: workOrder.repair_sla_hours,
      overdueHours: repairOverdueHours,
      fine: repairFine,
      deadline: format(addHours(startTime, workOrder.repair_sla_hours), 'yyyy-MM-dd HH:mm:ss')
    };
  }
  
  let totalFine = 0;
  if (result.responseSla) totalFine += result.responseSla.fine;
  if (result.repairSla) totalFine += result.repairSla.fine;
  
  if (workOrder.max_total_fine !== null && totalFine > workOrder.max_total_fine) {
    totalFine = workOrder.max_total_fine;
    if (result.responseSla) result.responseSla.fine = 0;
    if (result.repairSla) result.repairSla.fine = totalFine;
  }
  
  result.totalFine = totalFine;
  
  const exemptionRequests = db.prepare(`
    SELECT * FROM exemption_requests
    WHERE work_order_id = ?
    ORDER BY created_at DESC
  `).all(workOrderId);
  
  result.exemptionRequests = exemptionRequests;
  
  let approvedExemptionAmount = 0;
  for (const req of exemptionRequests) {
    if (req.status === 'approved') {
      approvedExemptionAmount += req.amount;
    }
  }
  
  result.approvedExemptionAmount = approvedExemptionAmount;
  result.netFine = Math.max(0, totalFine - approvedExemptionAmount);
  
  return result;
}

function canModifyWorkOrder(workOrderId) {
  const workOrder = db.prepare(`
    SELECT is_settled FROM work_orders WHERE id = ?
  `).get(workOrderId);
  
  if (!workOrder) return false;
  return workOrder.is_settled !== 1;
}

function getWorkOrdersForSettlement(month, year) {
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = month === '12' 
    ? `${parseInt(year) + 1}-01-01`
    : `${year}-${(parseInt(month) + 1).toString().padStart(2, '0')}-01`;
  
  const workOrders = db.prepare(`
    SELECT wo.*, c.name as contract_name, c.customer_name
    FROM work_orders wo
    JOIN contracts c ON wo.contract_id = c.id
    WHERE wo.created_at >= ? AND wo.created_at < ?
    AND wo.is_settled = 0
    ORDER BY wo.created_at ASC
  `).all(startDate, endDate);
  
  return workOrders;
}

module.exports = {
  calculateSLA,
  canModifyWorkOrder,
  getWorkOrdersForSettlement,
  getTimelineForWorkOrder,
  EVENT_TYPES
};
