const {
  addBusinessDays,
  isSameDay,
  differenceInMinutes,
  formatISO,
  parseISO
} = require('date-fns');

const PRIORITY_SLA = {
  'critical': { hours: 2, businessDays: false },
  'high': { hours: 8, businessDays: false },
  'medium': { hours: 24, businessDays: false },
  'low': { businessDays: 3 }
};

const PAUSE_TYPES = {
  'customer_waiting': { label: '客户等待', excludeFromSLA: true, blame: 'customer' },
  'third_party_waiting': { label: '第三方等待', excludeFromSLA: true, blame: 'third_party' },
  'internal_waiting': { label: '内部等待', excludeFromSLA: false, blame: 'internal' },
  'holiday': { label: '节假日', excludeFromSLA: true, blame: 'none' }
};

let tickets = new Map();
let ticketCounter = 1;

const generateId = () => `T-${String(ticketCounter++).padStart(6, '0')}`;

const isHoliday = (date) => {
  const month = date.getMonth();
  const day = date.getDate();
  const weekDay = date.getDay();
  
  if (weekDay === 0 || weekDay === 6) return true;
  
  const fixedHolidays = [
    { month: 0, day: 1 },
    { month: 4, day: 1 },
    { month: 9, day: 1 },
    { month: 11, day: 25 }
  ];
  
  return fixedHolidays.some(h => h.month === month && h.day === day);
};

const calculateSLA = (priority, startTime, endTime, events = []) => {
  const slaConfig = PRIORITY_SLA[priority];
  if (!slaConfig) {
    return { totalMinutes: 0, usedMinutes: 0, remainingMinutes: 0, isOvertime: false };
  }

  let totalMinutes;
  if (slaConfig.businessDays) {
    const endDate = addBusinessDays(startTime, slaConfig.businessDays);
    totalMinutes = differenceInMinutes(endDate, startTime);
  } else {
    totalMinutes = slaConfig.hours * 60;
  }

  let usedMinutes = 0;
  let currentTime = new Date(startTime);
  const effectiveEndTime = endTime || new Date();
  
  while (currentTime < effectiveEndTime) {
    const nextMinute = new Date(currentTime.getTime() + 60000);
    const isPaused = isTimePaused(currentTime, events);
    
    if (!isPaused && !isHoliday(currentTime)) {
      usedMinutes++;
    }
    
    currentTime = nextMinute;
  }

  const remainingMinutes = Math.max(0, totalMinutes - usedMinutes);
  const isOvertime = endTime ? usedMinutes > totalMinutes : usedMinutes >= totalMinutes;

  return {
    totalMinutes,
    usedMinutes,
    remainingMinutes,
    isOvertime
  };
};

const isTimePaused = (time, events) => {
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.type === 'pause' && event.effective) {
      const pauseTime = new Date(event.timestamp);
      const resumeEvent = events.slice(i + 1).find(e => e.type === 'resume' && e.effective);
      const resumeTime = resumeEvent ? new Date(resumeEvent.timestamp) : new Date(8640000000000000);
      
      if (time >= pauseTime && time < resumeTime) {
        return true;
      }
    }
  }
  return false;
};

const calculatePauseDuration = (events, pauseType) => {
  let totalMinutes = 0;
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.type === 'pause' && event.pauseType === pauseType && event.effective) {
      const pauseTime = new Date(event.timestamp);
      const resumeEvent = events.slice(i + 1).find(e => e.type === 'resume' && e.effective);
      const resumeTime = resumeEvent ? new Date(resumeEvent.timestamp) : new Date();
      
      totalMinutes += differenceInMinutes(resumeTime, pauseTime);
    }
  }
  
  return totalMinutes;
};

const createTicket = ({ title, type, priority, customerId, description }) => {
  const id = generateId();
  const now = formatISO(new Date());
  
  const ticket = {
    id,
    title,
    type,
    priority,
    customerId,
    description,
    status: 'open',
    assignee: null,
    createdAt: now,
    startedAt: null,
    closedAt: null,
    events: [],
    isPaused: false,
    currentPauseType: null,
    appeal: null,
    slaResult: null
  };
  
  tickets.set(id, ticket);
  return ticket;
};

const assignPriority = (ticketId, priority) => {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;
  if (ticket.status === 'closed') {
    throw new Error('Ticket is closed and cannot be modified');
  }
  
  if (!PRIORITY_SLA[priority]) {
    throw new Error(`Invalid priority: ${priority}`);
  }
  
  ticket.priority = priority;
  ticket.events.push({
    type: 'priority_changed',
    timestamp: formatISO(new Date()),
    priority,
    effective: true
  });
  
  return ticket;
};

const startProcessing = (ticketId, assignee) => {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;
  if (ticket.status === 'closed') {
    throw new Error('Ticket is closed and cannot be modified');
  }
  
  const now = formatISO(new Date());
  ticket.assignee = assignee;
  ticket.startedAt = now;
  ticket.status = 'in_progress';
  ticket.events.push({
    type: 'start',
    timestamp: now,
    assignee,
    effective: true
  });
  
  return ticket;
};

const pauseSLA = (ticketId, pauseType, reason) => {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;
  if (ticket.status === 'closed') {
    throw new Error('Ticket is closed and cannot be modified');
  }
  
  if (!PAUSE_TYPES[pauseType]) {
    throw new Error(`Invalid pause type: ${pauseType}`);
  }
  
  if (!reason || reason.trim() === '') {
    throw new Error('Pause reason is required');
  }
  
  if (ticket.isPaused && ticket.currentPauseType === pauseType) {
    return ticket;
  }
  
  const now = formatISO(new Date());
  ticket.isPaused = true;
  ticket.currentPauseType = pauseType;
  ticket.events.push({
    type: 'pause',
    timestamp: now,
    pauseType,
    reason: reason.trim(),
    pauseLabel: PAUSE_TYPES[pauseType].label,
    effective: true
  });
  
  return ticket;
};

const resumeSLA = (ticketId) => {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;
  if (ticket.status === 'closed') {
    throw new Error('Ticket is closed and cannot be modified');
  }
  
  if (!ticket.isPaused) {
    return ticket;
  }
  
  const now = formatISO(new Date());
  ticket.isPaused = false;
  ticket.currentPauseType = null;
  ticket.events.push({
    type: 'resume',
    timestamp: now,
    effective: true
  });
  
  return ticket;
};

const closeTicket = (ticketId) => {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;
  if (ticket.status === 'closed') {
    return ticket;
  }
  
  const now = formatISO(new Date());
  ticket.closedAt = now;
  ticket.status = 'closed';
  
  const startTime = ticket.startedAt ? new Date(ticket.startedAt) : new Date(ticket.createdAt);
  const sla = calculateSLA(ticket.priority, startTime, new Date(now), ticket.events);
  ticket.slaResult = {
    ...sla,
    calculatedAt: now
  };
  
  ticket.events.push({
    type: 'close',
    timestamp: now,
    slaResult: {
      isOvertime: sla.isOvertime,
      usedMinutes: sla.usedMinutes,
      totalMinutes: sla.totalMinutes
    },
    effective: true
  });
  
  return ticket;
};

const appealTicket = (ticketId, appealReason, adjustPauseReason) => {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;
  if (ticket.status !== 'closed') {
    throw new Error('Only closed tickets can be appealed');
  }
  
  ticket.appeal = {
    reason: appealReason,
    adjustPauseReason,
    createdAt: formatISO(new Date()),
    status: 'pending'
  };
  
  ticket.events.push({
    type: 'appeal_created',
    timestamp: formatISO(new Date()),
    appealReason,
    adjustPauseReason,
    effective: true
  });
  
  return ticket;
};

const approveAppeal = (ticketId, approvedPauseType, approvedReason) => {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;
  if (!ticket.appeal || ticket.appeal.status !== 'pending') {
    throw new Error('No pending appeal for this ticket');
  }
  
  if (!PAUSE_TYPES[approvedPauseType]) {
    throw new Error(`Invalid pause type: ${approvedPauseType}`);
  }
  
  if (!approvedReason || approvedReason.trim() === '') {
    throw new Error('Approve reason is required');
  }
  
  const startTime = ticket.startedAt ? new Date(ticket.startedAt) : new Date(ticket.createdAt);
  const closedAt = new Date(ticket.closedAt);
  
  ticket.events.push({
    type: 'appeal_approved',
    timestamp: formatISO(new Date()),
    approvedPauseType,
    approvedReason: approvedReason.trim(),
    pauseLabel: PAUSE_TYPES[approvedPauseType].label,
    effective: true,
    appliesFrom: formatISO(startTime),
    appliesTo: formatISO(closedAt)
  });
  
  const appealEvents = ticket.events.filter(e => 
    e.type === 'appeal_approved' && e.effective
  );
  
  const adjustedEvents = [...ticket.events];
  
  const sla = calculateSLA(ticket.priority, startTime, closedAt, adjustedEvents);
  
  let recalculatedSla = { ...sla };
  
  for (const appealEvent of appealEvents) {
    if (PAUSE_TYPES[appealEvent.approvedPauseType].excludeFromSLA) {
      const appealDuration = differenceInMinutes(closedAt, startTime);
      recalculatedSla.usedMinutes = Math.max(0, recalculatedSla.usedMinutes - appealDuration);
      recalculatedSla.remainingMinutes = Math.max(0, recalculatedSla.totalMinutes - recalculatedSla.usedMinutes);
      recalculatedSla.isOvertime = recalculatedSla.usedMinutes > recalculatedSla.totalMinutes;
    }
  }
  
  ticket.appeal.status = 'approved';
  ticket.appeal.approvedAt = formatISO(new Date());
  ticket.appeal.approvedPauseType = approvedPauseType;
  ticket.appeal.approvedReason = approvedReason.trim();
  
  ticket.slaResult = {
    ...recalculatedSla,
    calculatedAt: formatISO(new Date()),
    recalculated: true,
    originalSlaResult: sla
  };
  
  ticket.events.push({
    type: 'sla_recalculated',
    timestamp: formatISO(new Date()),
    originalSla: sla,
    newSla: recalculatedSla,
    effective: true
  });
  
  return ticket;
};

const getTicket = (ticketId) => {
  return tickets.get(ticketId);
};

const getAllTickets = () => {
  return Array.from(tickets.values());
};

const getStatistics = (startDate, endDate) => {
  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date();
  
  const allTickets = getAllTickets();
  const closedTickets = allTickets.filter(t => {
    if (!t.closedAt) return false;
    const closed = new Date(t.closedAt);
    return closed >= start && closed <= end;
  });
  
  const total = closedTickets.length;
  const overtimeCount = closedTickets.filter(t => t.slaResult?.isOvertime).length;
  const overtimeRate = total > 0 ? (overtimeCount / total * 100).toFixed(2) : '0.00';
  
  let totalPauseMinutes = 0;
  const pauseByType = {};
  Object.keys(PAUSE_TYPES).forEach(type => {
    pauseByType[type] = {
      label: PAUSE_TYPES[type].label,
      minutes: 0,
      count: 0
    };
  });
  
  const customerWaitingMinutes = 0;
  const internalDelayMinutes = 0;
  
  closedTickets.forEach(ticket => {
    Object.keys(PAUSE_TYPES).forEach(type => {
      const duration = calculatePauseDuration(ticket.events, type);
      pauseByType[type].minutes += duration;
      totalPauseMinutes += duration;
      
      const pauseEvents = ticket.events.filter(
        e => e.type === 'pause' && e.pauseType === type && e.effective
      );
      pauseByType[type].count += pauseEvents.length;
    });
  });
  
  return {
    period: {
      start: formatISO(start),
      end: formatISO(end)
    },
    summary: {
      totalTickets: total,
      overtimeTickets: overtimeCount,
      overtimeRate: `${overtimeRate}%`,
      totalPauseMinutes,
      totalPauseHours: (totalPauseMinutes / 60).toFixed(2)
    },
    pauseBreakdown: pauseByType,
    responsibility: {
      customerWaitingMinutes,
      internalDelayMinutes,
      customerWaitingHours: (customerWaitingMinutes / 60).toFixed(2),
      internalDelayHours: (internalDelayMinutes / 60).toFixed(2)
    }
  };
};

const getTicketTimeline = (ticketId) => {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;
  
  const timeline = [];
  
  timeline.push({
    time: ticket.createdAt,
    event: '工单创建',
    details: `类型: ${ticket.type}, 优先级: ${ticket.priority}`
  });
  
  ticket.events.forEach(event => {
    if (!event.effective) return;
    
    let eventDesc = '';
    let details = '';
    
    switch (event.type) {
      case 'start':
        eventDesc = '开始处理';
        details = `处理人: ${event.assignee}`;
        break;
      case 'pause':
        eventDesc = `暂停 (${event.pauseLabel})`;
        details = `原因: ${event.reason}`;
        break;
      case 'resume':
        eventDesc = '恢复计时';
        details = '';
        break;
      case 'close':
        eventDesc = '关闭工单';
        details = event.slaResult.isOvertime 
          ? `超时: 是, 用时: ${event.slaResult.usedMinutes}分钟, 限制: ${event.slaResult.totalMinutes}分钟`
          : `超时: 否, 用时: ${event.slaResult.usedMinutes}分钟, 限制: ${event.slaResult.totalMinutes}分钟`;
        break;
      case 'appeal_created':
        eventDesc = '申诉创建';
        details = `原因: ${event.appealReason}`;
        break;
      case 'appeal_approved':
        eventDesc = `申诉通过 (${event.pauseLabel})`;
        details = `原因: ${event.approvedReason}`;
        break;
      case 'sla_recalculated':
        eventDesc = 'SLA 重算';
        const wasOvertime = event.originalSla.isOvertime;
        const isNowOvertime = event.newSla.isOvertime;
        details = wasOvertime && !isNowOvertime 
          ? '状态变更: 超时 -> 未超时'
          : `用时: ${event.originalSla.usedMinutes} -> ${event.newSla.usedMinutes}分钟`;
        break;
      case 'priority_changed':
        eventDesc = '优先级变更';
        details = `新优先级: ${event.priority}`;
        break;
    }
    
    if (eventDesc) {
      timeline.push({
        time: event.timestamp,
        event: eventDesc,
        details
      });
    }
  });
  
  timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
  
  return {
    ticketId: ticket.id,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    sla: ticket.slaResult,
    timeline
  };
};

module.exports = {
  PRIORITY_SLA,
  PAUSE_TYPES,
  createTicket,
  assignPriority,
  startProcessing,
  pauseSLA,
  resumeSLA,
  closeTicket,
  appealTicket,
  approveAppeal,
  getTicket,
  getAllTickets,
  getStatistics,
  getTicketTimeline
};
