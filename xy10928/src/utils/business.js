const moment = require('moment');
const { get } = require('../config/database');

const PACKAGE_STATUS = {
  IN_STOCK: 'in_stock',
  PENDING_PICKUP: 'pending_pickup',
  PICKED_UP: 'picked_up',
  REJECTED: 'rejected',
  PENDING_RETURN: 'pending_return',
  RETURNED: 'returned',
  EXPIRED: 'expired'
};

const RETENTION_LEVELS = {
  NORMAL: 'normal',
  WARNING: 'warning',
  URGENT: 'urgent',
  CRITICAL: 'critical'
};

const REMINDER_INTERVALS = {
  normal: 24,
  warning: 12,
  urgent: 6,
  critical: 3
};

function calculateRetentionLevel(inTime) {
  const hours = moment().diff(moment(inTime), 'hours');
  
  if (hours >= 72) return RETENTION_LEVELS.CRITICAL;
  if (hours >= 48) return RETENTION_LEVELS.URGENT;
  if (hours >= 24) return RETENTION_LEVELS.WARNING;
  return RETENTION_LEVELS.NORMAL;
}

async function canSendReminder(packageId) {
  const pkg = await get('SELECT * FROM packages WHERE id = ?', [packageId]);
  if (!pkg) return { allowed: false, reason: '包裹不存在' };
  
  if (pkg.status !== PACKAGE_STATUS.IN_STOCK && pkg.status !== PACKAGE_STATUS.PENDING_PICKUP) {
    return { allowed: false, reason: '包裹状态不允许催取' };
  }
  
  if (!pkg.last_reminder_time) {
    return { allowed: true };
  }
  
  const level = calculateRetentionLevel(pkg.in_time);
  const intervalHours = REMINDER_INTERVALS[level];
  const hoursSinceLast = moment().diff(moment(pkg.last_reminder_time), 'hours');
  
  if (hoursSinceLast < intervalHours) {
    return { 
      allowed: false, 
      reason: `催取间隔不足，${level}级滞留需间隔${intervalHours}小时，当前仅${hoursSinceLast.toFixed(1)}小时` 
    };
  }
  
  return { allowed: true };
}

function validateStatusTransition(currentStatus, targetStatus) {
  const transitions = {
    [PACKAGE_STATUS.IN_STOCK]: [PACKAGE_STATUS.PENDING_PICKUP, PACKAGE_STATUS.REJECTED, PACKAGE_STATUS.PICKED_UP],
    [PACKAGE_STATUS.PENDING_PICKUP]: [PACKAGE_STATUS.PICKED_UP, PACKAGE_STATUS.REJECTED],
    [PACKAGE_STATUS.REJECTED]: [PACKAGE_STATUS.PENDING_RETURN],
    [PACKAGE_STATUS.PENDING_RETURN]: [PACKAGE_STATUS.RETURNED],
    [PACKAGE_STATUS.PICKED_UP]: [],
    [PACKAGE_STATUS.RETURNED]: [],
    [PACKAGE_STATUS.EXPIRED]: []
  };
  
  return transitions[currentStatus]?.includes(targetStatus) ?? false;
}

function getRetentionHours(inTime) {
  return moment().diff(moment(inTime), 'hours');
}

module.exports = {
  PACKAGE_STATUS,
  RETENTION_LEVELS,
  REMINDER_INTERVALS,
  calculateRetentionLevel,
  canSendReminder,
  validateStatusTransition,
  getRetentionHours
};
