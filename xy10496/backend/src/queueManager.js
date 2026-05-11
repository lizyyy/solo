const { readJSON, writeJSON, PHONE_CACHE_FILE, HISTORY_FILE, STATE_FILE } = require('./dataStore');

const CONFIG = {
  MIN_PHONE_INTERVAL: 60000,
  MAX_REQUEUE_LIMIT: 3,
  BUSINESS_TYPES: ['card', 'after_sale', 'consultation']
};

let state = {
  counters: { card: 0, after_sale: 0, consultation: 0 },
  queues: { card: [], after_sale: [], consultation: [] },
  windows: [
    { id: 1, name: '窗口1', status: 'open', currentNumber: null, processedToday: 0 },
    { id: 2, name: '窗口2', status: 'open', currentNumber: null, processedToday: 0 },
    { id: 3, name: '窗口3', status: 'open', currentNumber: null, processedToday: 0 }
  ],
  missedNumbers: [],
  history: [],
  phoneCache: {},
  currentDate: new Date().toISOString().split('T')[0]
};

function loadState() {
  const savedState = readJSON(STATE_FILE, null);
  const today = new Date().toISOString().split('T')[0];
  
  if (savedState) {
    if (savedState.currentDate === today) {
      state = { ...state, ...savedState };
    } else {
      state.history = savedState.history || [];
      state.phoneCache = savedState.phoneCache || {};
      state.currentDate = today;
    }
  }
  loadHistory();
  loadPhoneCache();
}

function loadHistory() {
  const savedHistory = readJSON(HISTORY_FILE, []);
  if (Array.isArray(savedHistory)) {
    state.history = savedHistory;
  }
}

function loadPhoneCache() {
  const savedCache = readJSON(PHONE_CACHE_FILE, {});
  if (typeof savedCache === 'object') {
    state.phoneCache = savedCache;
  }
}

function saveState() {
  writeJSON(STATE_FILE, state);
  writeJSON(HISTORY_FILE, state.history);
  writeJSON(PHONE_CACHE_FILE, state.phoneCache);
}

function generateNumber(businessType) {
  state.counters[businessType]++;
  const prefix = { card: 'C', after_sale: 'A', consultation: 'Z' }[businessType];
  return `${prefix}${String(state.counters[businessType]).padStart(3, '0')}`;
}

function takeNumber({ name, phone, businessType, isSenior = false, isReservation = false, reservationId = '' }) {
  const now = Date.now();
  
  if (state.phoneCache[phone] && now - state.phoneCache[phone] < CONFIG.MIN_PHONE_INTERVAL) {
    return { success: false, message: '同一手机号短时间内不能重复取号，请稍后再试' };
  }
  
  const ticketNumber = generateNumber(businessType);
  const ticket = {
    id: ticketNumber,
    name,
    phone,
    businessType,
    isSenior,
    isReservation,
    reservationId,
    status: 'waiting',
    createdAt: now,
    calledAt: null,
    completedAt: null,
    missedAt: null,
    processedByWindow: null,
    requeueCount: 0,
    history: [{ action: 'created', timestamp: now }]
  };
  
  if (isSenior || isReservation) {
    state.queues[businessType].unshift(ticket);
  } else {
    state.queues[businessType].push(ticket);
  }
  
  state.phoneCache[phone] = now;
  saveState();
  
  return { success: true, ticket };
}

function getQueue(businessType) {
  return state.queues[businessType] || [];
}

function getAllQueues() {
  return { ...state.queues };
}

function getWindows() {
  return [...state.windows];
}

function getMissedNumbers() {
  return [...state.missedNumbers];
}

function callNextNumber(windowId, businessType = null) {
  const window = state.windows.find(w => w.id === windowId);
  
  if (!window) {
    return { success: false, message: '窗口不存在' };
  }
  
  if (window.status !== 'open') {
    return { success: false, message: '窗口已关闭，无法叫号' };
  }
  
  let targetQueueName = businessType;
  if (!targetQueueName) {
    for (const type of CONFIG.BUSINESS_TYPES) {
      if (state.queues[type].length > 0) {
        targetQueueName = type;
        break;
      }
    }
  }
  
  if (!targetQueueName || state.queues[targetQueueName].length === 0) {
    return { success: false, message: '当前没有等待的号码' };
  }
  
  const ticket = state.queues[targetQueueName].shift();
  ticket.status = 'calling';
  ticket.calledAt = Date.now();
  ticket.processedByWindow = windowId;
  ticket.history.push({ action: 'called', window: windowId, timestamp: Date.now() });
  
  window.currentNumber = ticket;
  
  saveState();
  
  return { success: true, ticket, window };
}

function markMissed(windowId) {
  const window = state.windows.find(w => w.id === windowId);
  
  if (!window || !window.currentNumber) {
    return { success: false, message: '当前没有正在处理的号码' };
  }
  
  const ticket = window.currentNumber;
  ticket.status = 'missed';
  ticket.missedAt = Date.now();
  ticket.history.push({ action: 'missed', window: windowId, timestamp: Date.now() });
  
  state.missedNumbers.push(ticket);
  window.currentNumber = null;
  
  saveState();
  
  return { success: true, ticket };
}

function requeue(ticketId) {
  const index = state.missedNumbers.findIndex(t => t.id === ticketId);
  
  if (index === -1) {
    return { success: false, message: '未找到该号码' };
  }
  
  const ticket = state.missedNumbers[index];
  
  if (ticket.status === 'completed') {
    return { success: false, message: '已完成号码不能再回队' };
  }
  
  if (ticket.requeueCount >= CONFIG.MAX_REQUEUE_LIMIT) {
    return { success: false, message: `过号重排次数已达上限(${CONFIG.MAX_REQUEUE_LIMIT}次)，无法继续重排` };
  }
  
  ticket.requeueCount++;
  ticket.status = 'waiting';
  ticket.history.push({ action: 'requeued', timestamp: Date.now() });
  
  state.queues[ticket.businessType].unshift(ticket);
  state.missedNumbers.splice(index, 1);
  
  saveState();
  
  return { success: true, ticket };
}

function completeNumber(windowId) {
  const window = state.windows.find(w => w.id === windowId);
  
  if (!window || !window.currentNumber) {
    return { success: false, message: '当前没有正在处理的号码' };
  }
  
  const ticket = window.currentNumber;
  ticket.status = 'completed';
  ticket.completedAt = Date.now();
  ticket.history.push({ action: 'completed', window: windowId, timestamp: Date.now() });
  
  state.history.push(ticket);
  window.processedToday++;
  window.currentNumber = null;
  
  saveState();
  
  return { success: true, ticket };
}

function toggleWindow(windowId, status) {
  const window = state.windows.find(w => w.id === windowId);
  
  if (!window) {
    return { success: false, message: '窗口不存在' };
  }
  
  window.status = status;
  saveState();
  
  return { success: true, window };
}

function getTodayHistory() {
  const today = new Date().toISOString().split('T')[0];
  return state.history.filter(t => {
    const ticketDate = new Date(t.createdAt).toISOString().split('T')[0];
    return ticketDate === today;
  });
}

function getStatistics() {
  const today = new Date().toISOString().split('T')[0];
  const todayHistory = state.history.filter(t => {
    const ticketDate = new Date(t.createdAt).toISOString().split('T')[0];
    return ticketDate === today;
  });
  
  const totalWaiting = Object.values(state.queues).reduce((sum, q) => sum + q.length, 0);
  const totalMissed = state.missedNumbers.length;
  const totalCompleted = todayHistory.length;
  
  const totalProcessed = state.windows.reduce((sum, w) => sum + w.processedToday, 0);
  
  const avgWaitTime = todayHistory.length > 0
    ? Math.round(todayHistory.reduce((sum, t) => {
      const wait = t.calledAt ? (t.calledAt - t.createdAt) / 1000 : 0;
      return sum + wait;
    }, 0) / todayHistory.length)
    : 0;
  
  return {
    totalWaiting,
    totalMissed,
    totalCompleted,
    totalProcessed,
    avgWaitTime,
    today: today,
    windowStats: state.windows.map(w => ({
      id: w.id,
      name: w.name,
      processedToday: w.processedToday
    }))
  };
}

function getIncompleteNumbers() {
  const incomplete = [];
  
  Object.values(state.queues).forEach(queue => {
    incomplete.push(...queue);
  });
  incomplete.push(...state.missedNumbers);
  
  state.windows.forEach(w => {
    if (w.currentNumber) incomplete.push(w.currentNumber);
  });
  
  return incomplete;
}

function getTicketHistory(ticketId) {
  let ticket = null;
  
  for (const queue of Object.values(state.queues)) {
    const found = queue.find(t => t.id === ticketId);
    if (found) {
      ticket = found;
      break;
    }
  }
  
  if (!ticket) {
    ticket = state.missedNumbers.find(t => t.id === ticketId);
  }
  
  if (!ticket) {
    const windowWithTicket = state.windows.find(w => w.currentNumber && w.currentNumber.id === ticketId);
    if (windowWithTicket) ticket = windowWithTicket.currentNumber;
  }
  
  if (!ticket) {
    ticket = state.history.find(t => t.id === ticketId);
  }
  
  return ticket;
}

module.exports = {
  CONFIG,
  loadState,
  takeNumber,
  getQueue,
  getAllQueues,
  getWindows,
  getMissedNumbers,
  callNextNumber,
  markMissed,
  requeue,
  completeNumber,
  toggleWindow,
  getTodayHistory,
  getStatistics,
  getIncompleteNumbers,
  getTicketHistory
};
