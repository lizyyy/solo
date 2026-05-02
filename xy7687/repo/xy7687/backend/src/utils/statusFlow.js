const STATUS_MAP = {
  pending_inspection: { label: '待检测', color: '#e6a23c' },
  quoting: { label: '报价中', color: '#409eff' },
  repairing: { label: '维修中', color: '#f56c6c' },
  pending_pickup: { label: '待取机', color: '#909399' },
  completed: { label: '已完成', color: '#67c23a' },
  cancelled: { label: '已取消', color: '#909399' }
};

const STATUS_TRANSITIONS = {
  pending_inspection: ['quoting', 'cancelled'],
  quoting: ['repairing', 'cancelled'],
  repairing: ['pending_pickup', 'cancelled'],
  pending_pickup: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

const TRANSITION_REASONS = {
  'pending_inspection->quoting': '检测完成，开始报价',
  'quoting->repairing': '客户同意报价，开始维修',
  'repairing->pending_pickup': '维修完成，待客户取机',
  'pending_pickup->completed': '客户已取机，工单完成',
  'pending_inspection->cancelled': '客户取消维修',
  'quoting->cancelled': '客户取消维修',
  'repairing->cancelled': '客户取消维修',
  'pending_pickup->cancelled': '客户取消维修'
};

const canTransition = (fromStatus, toStatus) => {
  if (!STATUS_TRANSITIONS[fromStatus]) {
    return false;
  }
  return STATUS_TRANSITIONS[fromStatus].includes(toStatus);
};

const getNextStatuses = (currentStatus) => {
  if (!STATUS_TRANSITIONS[currentStatus]) {
    return [];
  }
  return STATUS_TRANSITIONS[currentStatus].map(status => ({
    value: status,
    label: STATUS_MAP[status].label,
    color: STATUS_MAP[status].color
  }));
};

const getDisabledReason = (currentStatus, targetStatus) => {
  if (currentStatus === 'completed') {
    return '工单已完成，无法修改状态';
  }
  if (currentStatus === 'cancelled') {
    return '工单已取消，无法修改状态';
  }
  
  const validTransitions = STATUS_TRANSITIONS[currentStatus];
  if (!validTransitions.includes(targetStatus)) {
    if (validTransitions.length === 0) {
      return `当前状态"${STATUS_MAP[currentStatus].label}"无法继续流转`;
    }
    const validLabels = validTransitions.map(s => STATUS_MAP[s].label).join('、');
    return `只能从"${STATUS_MAP[currentStatus].label}"流转到：${validLabels}`;
  }
  return null;
};

const getTransitionReason = (fromStatus, toStatus) => {
  const key = `${fromStatus}->${toStatus}`;
  return TRANSITION_REASONS[key] || '状态变更';
};

const generateTicketNo = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `WK${year}${month}${day}${random}`;
};

module.exports = {
  STATUS_MAP,
  STATUS_TRANSITIONS,
  canTransition,
  getNextStatuses,
  getDisabledReason,
  getTransitionReason,
  generateTicketNo
};
