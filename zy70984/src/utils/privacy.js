const dayjs = require('dayjs');

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function maskName(name) {
  if (!name || name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name.slice(-1);
}

function maskAddress(address) {
  if (!address) return address;
  if (address.length <= 6) return '*'.repeat(address.length);
  return address.slice(0, 3) + '****' + address.slice(-3);
}

function maskPackageData(pkg) {
  if (!pkg) return pkg;
  return {
    ...pkg,
    receiver_name: maskName(pkg.receiver_name),
    receiver_phone: maskPhone(pkg.receiver_phone),
    receiver_address: pkg.receiver_address ? maskAddress(pkg.receiver_address) : undefined
  };
}

function getStatusText(status) {
  const map = {
    pending: '待取件',
    notified: '已通知',
    picked: '已取件',
    returning: '退回中',
    returned: '已退回',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function getOverdueInfo(pkg, rule) {
  if (!pkg || !rule) return null;
  const arrived = dayjs(pkg.arrived_at);
  const now = dayjs();
  const days = now.diff(arrived, 'day');
  const isOverdue = days >= rule.overdue_days;
  return {
    is_overdue: isOverdue,
    overdue_days: days,
    overdue_threshold: rule.overdue_days,
    description: isOverdue
      ? `已超期${days}天（规则：到件${rule.overdue_days}天未取件）`
      : `正常，到件${days}天（规则：${rule.overdue_days}天超期）`
  };
}

function getSmsWarningInfo(pkg, rule) {
  if (!pkg || !rule) return null;
  const count = pkg.sms_count || 0;
  const max = rule.max_sms_count;
  const isMaxed = count >= max;
  return {
    is_sms_maxed: isMaxed,
    sms_count: count,
    sms_max: max,
    description: isMaxed
      ? `已催取${count}次，达到退回触发条件（规则：最多${max}次）`
      : `已催取${count}次（规则：${max}次触发退回）`
  };
}

module.exports = {
  maskPhone,
  maskName,
  maskAddress,
  maskPackageData,
  getStatusText,
  getOverdueInfo,
  getSmsWarningInfo
};
