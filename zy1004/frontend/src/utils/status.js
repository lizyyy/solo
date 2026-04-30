export const ORDER_STATUS = {
  PENDING_CONFIRM: '待确认',
  CONFIRMED: '已预约',
  IN_PROGRESS: '维修中',
  AWAITING_PICKUP: '待取件',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export const STATUS_COLOR = {
  '待确认': 'orange',
  '已预约': 'blue',
  '维修中': 'processing',
  '待取件': 'cyan',
  '已完成': 'success',
  '已取消': 'default',
};

export const DEVICE_TYPES = [
  '电饭煲',
  '空气炸锅',
  '咖啡机',
  '冰箱',
  '洗衣机',
  '微波炉',
  '烤箱',
  '洗碗机',
  '其他',
];

export const APPOINTMENT_TYPES = [
  { value: '到店', label: '到店维修' },
  { value: '上门', label: '上门维修' },
];

export const STATUS_TRANSITIONS = {
  '待确认': ['已预约', '已取消'],
  '已预约': ['维修中', '已取消'],
  '维修中': ['待取件', '已取消'],
  '待取件': ['已完成', '已取消'],
  '已完成': [],
  '已取消': [],
};

export function canTransition(from, to) {
  return STATUS_TRANSITIONS[from]?.includes(to) || false;
}

export function getNextStatuses(currentStatus) {
  return STATUS_TRANSITIONS[currentStatus] || [];
}
