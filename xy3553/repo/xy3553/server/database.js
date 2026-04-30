const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const ticketsFile = path.join(dataDir, 'tickets.json');
const historyFile = path.join(dataDir, 'history.json');

const STATUS_FLOW = {
  '待检测': ['报价中', '已取消'],
  '报价中': ['待检测', '维修中', '已取消'],
  '维修中': ['报价中', '待取机', '已取消'],
  '待取机': ['维修中', '已完成', '已取消'],
  '已完成': [],
  '已取消': []
};

const STATUS_COLORS = {
  '待检测': '#f59e0b',
  '报价中': '#3b82f6',
  '维修中': '#8b5cf6',
  '待取机': '#06b6d4',
  '已完成': '#22c55e',
  '已取消': '#6b7280'
};

let tickets = [];
let history = [];
let nextTicketId = 1;

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadData() {
  ensureDataDir();
  
  try {
    if (fs.existsSync(ticketsFile)) {
      const ticketsData = fs.readFileSync(ticketsFile, 'utf8');
      tickets = JSON.parse(ticketsData);
      if (tickets.length > 0) {
        nextTicketId = Math.max(...tickets.map(t => t.id)) + 1;
      }
    }
  } catch (err) {
    console.error('加载工单数据失败:', err.message);
    tickets = [];
  }
  
  try {
    if (fs.existsSync(historyFile)) {
      const historyData = fs.readFileSync(historyFile, 'utf8');
      history = JSON.parse(historyData);
    }
  } catch (err) {
    console.error('加载历史记录失败:', err.message);
    history = [];
  }
}

function saveTickets() {
  ensureDataDir();
  try {
    fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2), 'utf8');
  } catch (err) {
    console.error('保存工单数据失败:', err.message);
  }
}

function saveHistory() {
  ensureDataDir();
  try {
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf8');
  } catch (err) {
    console.error('保存历史记录失败:', err.message);
  }
}

function generateTicketNumber(prefix) {
  const matchingTickets = tickets.filter(t => t.ticket_number.startsWith(prefix));
  let nextNum = 1;
  
  if (matchingTickets.length > 0) {
    const maxNum = Math.max(...matchingTickets.map(t => {
      const match = t.ticket_number.match(/(\d{4})$/);
      return match ? parseInt(match[1]) : 0;
    }));
    nextNum = maxNum + 1;
  }
  
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

function createSampleData() {
  const now = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();

  const sampleTickets = [
    {
      id: nextTicketId++,
      ticket_number: '2024010001',
      customer_name: '张三',
      customer_phone: '13800138001',
      device_model: 'iPhone 13 Pro',
      fault_description: '屏幕碎裂，触摸不灵',
      quote_amount: 1200,
      repair_parts: '原装屏幕总成',
      expected_pickup_time: tomorrow,
      status: '维修中',
      notes: '客户比较着急，尽量优先处理',
      created_at: yesterday,
      updated_at: now
    },
    {
      id: nextTicketId++,
      ticket_number: '2024010002',
      customer_name: '李四',
      customer_phone: '13800138002',
      device_model: '华为 Mate 40 Pro',
      fault_description: '电池不耐用，一天要充三次',
      quote_amount: 399,
      repair_parts: '原装电池',
      expected_pickup_time: now,
      status: '待取机',
      notes: '',
      created_at: yesterday,
      updated_at: now
    },
    {
      id: nextTicketId++,
      ticket_number: '2024010003',
      customer_name: '王五',
      customer_phone: '13800138003',
      device_model: '小米 12',
      fault_description: '进水后不开机',
      quote_amount: 0,
      repair_parts: '',
      expected_pickup_time: '',
      status: '待检测',
      notes: '需要先检测才能报价',
      created_at: now,
      updated_at: now
    },
    {
      id: nextTicketId++,
      ticket_number: '2024010004',
      customer_name: '赵六',
      customer_phone: '13800138004',
      device_model: 'iPhone 12',
      fault_description: '后置摄像头拍照模糊',
      quote_amount: 580,
      repair_parts: '',
      expected_pickup_time: '',
      status: '报价中',
      notes: '等待客户确认报价',
      created_at: now,
      updated_at: now
    },
    {
      id: nextTicketId++,
      ticket_number: '2024010005',
      customer_name: '孙七',
      customer_phone: '13800138005',
      device_model: 'OPPO Find X5',
      fault_description: '听筒没有声音',
      quote_amount: 150,
      repair_parts: '听筒排线',
      expected_pickup_time: yesterday,
      status: '已完成',
      notes: '已取机，客户很满意',
      created_at: twoDaysAgo,
      updated_at: yesterday
    }
  ];

  tickets = sampleTickets;

  history = [
    { id: 1, ticket_id: 1, from_status: null, to_status: '待检测', reason: '创建工单', created_at: yesterday },
    { id: 2, ticket_id: 1, from_status: '待检测', to_status: '报价中', reason: '检测完成，等待报价确认', created_at: yesterday },
    { id: 3, ticket_id: 1, from_status: '报价中', to_status: '维修中', reason: '客户确认报价，开始维修', created_at: now },
    { id: 4, ticket_id: 2, from_status: null, to_status: '待检测', reason: '创建工单', created_at: yesterday },
    { id: 5, ticket_id: 2, from_status: '待检测', to_status: '报价中', reason: '检测完成，等待报价确认', created_at: yesterday },
    { id: 6, ticket_id: 2, from_status: '报价中', to_status: '维修中', reason: '客户确认报价，开始维修', created_at: yesterday },
    { id: 7, ticket_id: 2, from_status: '维修中', to_status: '待取机', reason: '维修完成，等待取机', created_at: now },
    { id: 8, ticket_id: 3, from_status: null, to_status: '待检测', reason: '创建工单', created_at: now },
    { id: 9, ticket_id: 4, from_status: null, to_status: '待检测', reason: '创建工单', created_at: now },
    { id: 10, ticket_id: 4, from_status: '待检测', to_status: '报价中', reason: '检测完成，等待报价确认', created_at: now },
    { id: 11, ticket_id: 5, from_status: null, to_status: '待检测', reason: '创建工单', created_at: twoDaysAgo },
    { id: 12, ticket_id: 5, from_status: '待检测', to_status: '报价中', reason: '检测完成，等待报价确认', created_at: twoDaysAgo },
    { id: 13, ticket_id: 5, from_status: '报价中', to_status: '维修中', reason: '客户确认报价，开始维修', created_at: twoDaysAgo },
    { id: 14, ticket_id: 5, from_status: '维修中', to_status: '待取机', reason: '维修完成，等待取机', created_at: yesterday },
    { id: 15, ticket_id: 5, from_status: '待取机', to_status: '已完成', reason: '客户已取机', created_at: yesterday }
  ];

  saveTickets();
  saveHistory();
}

function initDatabase() {
  loadData();
  
  if (tickets.length === 0) {
    console.log('数据库为空，正在创建示例数据...');
    createSampleData();
    console.log('示例数据创建完成');
  }
}

function canTransition(from, to) {
  if (!from) return ['待检测'].includes(to);
  const allowed = STATUS_FLOW[from] || [];
  return allowed.includes(to);
}

function getNextStatuses(currentStatus) {
  return STATUS_FLOW[currentStatus] || [];
}

function getStatusColor(status) {
  return STATUS_COLORS[status] || '#6b7280';
}

function getAllTickets(options = {}) {
  let result = [...tickets];
  
  if (options.status && options.status !== '') {
    result = result.filter(t => t.status === options.status);
  }
  
  if (options.search && options.search.trim() !== '') {
    const searchTerm = options.search.trim().toLowerCase();
    result = result.filter(t => 
      t.customer_name.toLowerCase().includes(searchTerm) ||
      t.customer_phone.includes(searchTerm) ||
      t.device_model.toLowerCase().includes(searchTerm) ||
      t.ticket_number.toLowerCase().includes(searchTerm)
    );
  }
  
  if (options.start_date) {
    result = result.filter(t => new Date(t.created_at) >= new Date(options.start_date));
  }
  
  if (options.end_date) {
    const endDate = new Date(options.end_date);
    endDate.setHours(23, 59, 59, 999);
    result = result.filter(t => new Date(t.created_at) <= endDate);
  }
  
  result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  return result.map(t => ({
    ...t,
    statusColor: getStatusColor(t.status),
    nextStatuses: getNextStatuses(t.status)
  }));
}

function getTicketById(id) {
  const ticket = tickets.find(t => t.id === parseInt(id));
  if (!ticket) return null;
  
  const ticketHistory = history.filter(h => h.ticket_id === parseInt(id));
  ticketHistory.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  return {
    ...ticket,
    statusColor: getStatusColor(ticket.status),
    nextStatuses: getNextStatuses(ticket.status),
    history: ticketHistory
  };
}

function createTicket(data) {
  const now = new Date().toISOString();
  const monthPrefix = new Date().toISOString().slice(0, 7).replace('-', '');
  const ticketNumber = generateTicketNumber(monthPrefix);
  
  const newTicket = {
    id: nextTicketId++,
    ticket_number: ticketNumber,
    customer_name: data.customer_name.trim(),
    customer_phone: data.customer_phone.trim(),
    device_model: data.device_model.trim(),
    fault_description: data.fault_description.trim(),
    quote_amount: data.quote_amount || 0,
    repair_parts: data.repair_parts || '',
    expected_pickup_time: data.expected_pickup_time || null,
    status: '待检测',
    notes: data.notes || '',
    created_at: now,
    updated_at: now
  };
  
  tickets.push(newTicket);
  
  const newHistory = {
    id: history.length + 1,
    ticket_id: newTicket.id,
    from_status: null,
    to_status: '待检测',
    reason: '创建工单',
    created_at: now
  };
  history.push(newHistory);
  
  saveTickets();
  saveHistory();
  
  return {
    ...newTicket,
    statusColor: getStatusColor(newTicket.status),
    nextStatuses: getNextStatuses(newTicket.status)
  };
}

function updateTicket(id, data) {
  const ticketIndex = tickets.findIndex(t => t.id === parseInt(id));
  if (ticketIndex === -1) return null;
  
  const ticket = tickets[ticketIndex];
  const now = new Date().toISOString();
  
  const allowedFields = [
    'customer_name', 'customer_phone', 'device_model',
    'fault_description', 'quote_amount', 'repair_parts',
    'expected_pickup_time', 'notes'
  ];
  
  allowedFields.forEach(field => {
    if (data[field] !== undefined) {
      if (typeof data[field] === 'string') {
        ticket[field] = data[field].trim();
      } else {
        ticket[field] = data[field];
      }
    }
  });
  
  ticket.updated_at = now;
  
  saveTickets();
  
  return {
    ...ticket,
    statusColor: getStatusColor(ticket.status),
    nextStatuses: getNextStatuses(ticket.status)
  };
}

function changeTicketStatus(id, newStatus, reason) {
  const ticketIndex = tickets.findIndex(t => t.id === parseInt(id));
  if (ticketIndex === -1) return null;
  
  const ticket = tickets[ticketIndex];
  const oldStatus = ticket.status;
  
  if (!canTransition(oldStatus, newStatus)) {
    return {
      success: false,
      error: '状态流转不允许',
      message: `无法从"${oldStatus}"转移到"${newStatus}"`,
      allowedNextStatuses: getNextStatuses(oldStatus)
    };
  }
  
  const now = new Date().toISOString();
  
  ticket.status = newStatus;
  ticket.updated_at = now;
  
  const newHistory = {
    id: history.length + 1,
    ticket_id: ticket.id,
    from_status: oldStatus,
    to_status: newStatus,
    reason: reason || '状态变更',
    created_at: now
  };
  history.push(newHistory);
  
  saveTickets();
  saveHistory();
  
  const ticketHistory = history.filter(h => h.ticket_id === ticket.id);
  ticketHistory.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  return {
    success: true,
    data: {
      ...ticket,
      statusColor: getStatusColor(ticket.status),
      nextStatuses: getNextStatuses(ticket.status),
      history: ticketHistory
    }
  };
}

function getStatistics() {
  const summary = {
    total: tickets.length,
    byStatus: {}
  };
  
  tickets.forEach(t => {
    summary.byStatus[t.status] = (summary.byStatus[t.status] || 0) + 1;
  });
  
  return summary;
}

module.exports = {
  initDatabase,
  generateTicketNumber,
  canTransition,
  getNextStatuses,
  getStatusColor,
  STATUS_FLOW,
  STATUS_COLORS,
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  changeTicketStatus,
  getStatistics,
  tickets,
  history
};
