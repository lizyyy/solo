export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getPasswordTypeLabel(type) {
  const types = {
    guest: '客人入住密码',
    cleaning: '保洁密码',
    maintenance: '维修临时密码'
  };
  return types[type] || type;
}

export function getPasswordStatusBadge(status) {
  const statuses = {
    active: { class: 'badge-success', label: '生效中' },
    pending: { class: 'badge-warning', label: '待生效' },
    expired: { class: 'badge-secondary', label: '已过期' },
    revoked: { class: 'badge-danger', label: '已作废' }
  };
  return statuses[status] || { class: 'badge-secondary', label: status };
}

export function getPropertyStatusBadge(status) {
  const statuses = {
    active: { class: 'badge-success', label: '正常运营' },
    maintenance: { class: 'badge-warning', label: '维修中' },
    inactive: { class: 'badge-secondary', label: '停用' }
  };
  return statuses[status] || { class: 'badge-secondary', label: status };
}

export function getOrderStatusBadge(status) {
  const statuses = {
    upcoming: { class: 'badge-info', label: '待入住' },
    active: { class: 'badge-success', label: '入住中' },
    completed: { class: 'badge-secondary', label: '已完成' },
    cancelled: { class: 'badge-danger', label: '已取消' }
  };
  return statuses[status] || { class: 'badge-secondary', label: status };
}

export function getAnomalySeverityBadge(severity) {
  const severities = {
    high: { class: 'badge-danger', label: '高危' },
    medium: { class: 'badge-warning', label: '中危' },
    low: { class: 'badge-info', label: '低危' }
  };
  return severities[severity] || { class: 'badge-secondary', label: severity };
}

export function getAnomalyTypeLabel(type) {
  const types = {
    expired_still_active: '过期密码尝试访问',
    maintenance_unauthorized: '维修密码越权访问',
    time_overlap: '密码时间重叠',
    invalid_attempt: '非法尝试'
  };
  return types[type] || type;
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export function isSameDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isDateInRange(date, start, end) {
  const d = new Date(date).setHours(0, 0, 0, 0);
  const s = new Date(start).setHours(0, 0, 0, 0);
  const e = new Date(end).setHours(0, 0, 0, 0);
  return d >= s && d <= e;
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDateForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function generatePasswordExplanation(password) {
  const explanations = [];
  
  explanations.push(`密码类型：${getPasswordTypeLabel(password.type)}`);
  explanations.push(`有效期：${formatDateTime(password.validFrom)} 至 ${formatDateTime(password.validTo)}`);
  
  const now = new Date();
  const validFrom = new Date(password.validFrom);
  const validTo = new Date(password.validTo);
  
  if (password.status === 'revoked') {
    explanations.push('状态：🚫 已作废');
    explanations.push('说明：该密码已被管理员手动作废');
  } else if (now < validFrom) {
    explanations.push('状态：⏳ 待生效');
    explanations.push(`说明：密码将在 ${formatDateTime(validFrom)} 后生效`);
  } else if (now > validTo) {
    explanations.push('状态：❌ 已过期');
    explanations.push(`说明：密码已于 ${formatDateTime(validTo)} 过期`);
  } else {
    explanations.push('状态：✅ 生效中');
    explanations.push(`说明：密码在有效期内，可正常使用`);
  }
  
  if (password.type === 'maintenance') {
    explanations.push('⚠️ 注意：维修密码仅在房源处于维修状态时可用');
  }
  
  if (password.type === 'guest' && password.orderId) {
    explanations.push('📝 备注：该密码关联订单，退房后自动失效');
  }

  return explanations;
}
