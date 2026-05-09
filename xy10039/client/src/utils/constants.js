export const USER_ROLES = {
  admin: { label: '管理员', value: 'admin', color: 'red' },
  manager: { label: '经理', value: 'manager', color: 'orange' },
  operator: { label: '运营', value: 'operator', color: 'blue' },
  viewer: { label: '查看者', value: 'viewer', color: 'gray' }
};

export const REGISTRATION_STATUS = {
  pending: { label: '待确认', value: 'pending', color: 'orange', tagClass: 'tag-pending' },
  confirmed: { label: '已确认', value: 'confirmed', color: 'blue', tagClass: 'tag-confirmed' },
  rescheduled: { label: '已改期', value: 'rescheduled', color: 'purple', tagClass: 'tag-rescheduled' },
  cancelled: { label: '已取消', value: 'cancelled', color: 'red', tagClass: 'tag-cancelled' },
  no_show: { label: '未出席', value: 'no_show', color: 'gold', tagClass: 'tag-no-show' },
  completed: { label: '已完成', value: 'completed', color: 'green', tagClass: 'tag-completed' }
};

export const ACTIVITY_STATUS = {
  draft: { label: '草稿', value: 'draft', color: 'default' },
  published: { label: '已发布', value: 'published', color: 'blue' },
  in_progress: { label: '进行中', value: 'in_progress', color: 'processing' },
  completed: { label: '已完成', value: 'completed', color: 'success' },
  cancelled: { label: '已取消', value: 'cancelled', color: 'error' }
};

export const IMPORT_STATUS = {
  pending: { label: '待处理', value: 'pending', color: 'default' },
  processing: { label: '处理中', value: 'processing', color: 'processing' },
  completed: { label: '已完成', value: 'completed', color: 'success' },
  partial: { label: '部分成功', value: 'partial', color: 'warning' },
  failed: { label: '失败', value: 'failed', color: 'error' }
};

export const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['rescheduled', 'cancelled', 'no_show', 'completed'],
  rescheduled: ['confirmed', 'cancelled'],
  cancelled: [],
  no_show: ['completed'],
  completed: []
};

export function getRegistrationStatusLabel(status) {
  return REGISTRATION_STATUS[status]?.label || status;
}

export function getActivityStatusLabel(status) {
  return ACTIVITY_STATUS[status]?.label || status;
}

export function getUserRoleLabel(role) {
  return USER_ROLES[role]?.label || role;
}

export function getImportStatusLabel(status) {
  return IMPORT_STATUS[status]?.label || status;
}

export function canTransitionStatus(currentStatus, newStatus) {
  return STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
}

export function getAvailableTransitions(currentStatus) {
  return STATUS_TRANSITIONS[currentStatus] || [];
}
