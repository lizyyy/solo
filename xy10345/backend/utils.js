const { v4: uuidv4 } = require('uuid');
const { passwords, anomalies, auditLogs } = require('./data');

function generateRandomCode(length = 6) {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function checkTimeOverlap(newStart, newEnd, propertyId, excludeId = null) {
  const existingPasswords = passwords.filter(p => 
    p.propertyId === propertyId && 
    p.id !== excludeId &&
    p.status !== 'revoked'
  );

  for (const pwd of existingPasswords) {
    const start1 = new Date(newStart).getTime();
    const end1 = new Date(newEnd).getTime();
    const start2 = new Date(pwd.validFrom).getTime();
    const end2 = new Date(pwd.validTo).getTime();

    if (start1 < end2 && end1 > start2) {
      return {
        hasOverlap: true,
        conflictingPassword: pwd
      };
    }
  }

  return { hasOverlap: false };
}

function validatePassword(password, currentTime = new Date()) {
  const now = currentTime.getTime();
  const validFrom = new Date(password.validFrom).getTime();
  const validTo = new Date(password.validTo).getTime();

  let status = password.status;
  let reason = password.reason;

  if (password.status === 'revoked') {
    return { isValid: false, status: 'revoked', reason: '密码已被手动作废' };
  }

  if (now < validFrom) {
    status = 'pending';
    reason = '未到生效时间，密码暂未生效';
  } else if (now > validTo) {
    status = 'expired';
    reason = '已过有效期，密码已失效';
  } else {
    status = 'active';
    reason = '在有效期内，密码正常生效';
  }

  return {
    isValid: status === 'active',
    status,
    reason
  };
}

function checkMaintenanceAccess(password, propertyStatus) {
  if (password.type === 'maintenance' && propertyStatus !== 'maintenance') {
    const anomaly = {
      id: uuidv4(),
      propertyId: password.propertyId,
      passwordId: password.id,
      type: 'maintenance_unauthorized',
      description: '维修密码在非维修状态下尝试访问',
      severity: 'high',
      timestamp: new Date().toISOString(),
      resolved: false,
      resolution: null
    };
    anomalies.push(anomaly);

    const log = {
      id: uuidv4(),
      propertyId: password.propertyId,
      passwordId: password.id,
      action: 'block',
      description: '拦截维修密码越权访问',
      timestamp: new Date().toISOString()
    };
    auditLogs.push(log);

    return {
      allowed: false,
      reason: '维修密码仅在房源处于维修状态时有效',
      anomaly
    };
  }

  return { allowed: true };
}

function checkExpiredPasswordAttempt(password) {
  const validation = validatePassword(password);
  if (!validation.isValid && validation.status === 'expired') {
    const anomaly = {
      id: uuidv4(),
      propertyId: password.propertyId,
      passwordId: password.id,
      type: 'expired_still_active',
      description: '检测到过期密码尝试访问',
      severity: 'high',
      timestamp: new Date().toISOString(),
      resolved: false,
      resolution: null
    };
    anomalies.push(anomaly);

    const log = {
      id: uuidv4(),
      propertyId: password.propertyId,
      passwordId: password.id,
      action: 'block',
      description: '拦截过期密码访问',
      timestamp: new Date().toISOString()
    };
    auditLogs.push(log);

    return {
      blocked: true,
      reason: '密码已过期，访问被拦截',
      anomaly
    };
  }

  return { blocked: false };
}

function extendPasswordExpiry(passwordId, newEndTime) {
  const password = passwords.find(p => p.id === passwordId);
  if (!password) {
    return { success: false, message: '密码不存在' };
  }

  const overlapCheck = checkTimeOverlap(
    password.validFrom,
    newEndTime,
    password.propertyId,
    passwordId
  );

  if (overlapCheck.hasOverlap) {
    return {
      success: false,
      message: `延期时间与现有密码冲突：${overlapCheck.conflictingPassword.name}`
    };
  }

  password.validTo = newEndTime;
  password.reason = '已申请延迟退房，密码有效期已延长';

  const log = {
    id: uuidv4(),
    propertyId: password.propertyId,
    passwordId: password.id,
    action: 'extend',
    description: `密码有效期延长至 ${new Date(newEndTime).toLocaleString()}`,
    timestamp: new Date().toISOString()
  };
  auditLogs.push(log);

  return { success: true, password };
}

function revokePassword(passwordId, reason = '管理员手动作废') {
  const password = passwords.find(p => p.id === passwordId);
  if (!password) {
    return { success: false, message: '密码不存在' };
  }

  password.status = 'revoked';
  password.reason = reason;

  const log = {
    id: uuidv4(),
    propertyId: password.propertyId,
    passwordId: password.id,
    action: 'revoke',
    description: `手动作废密码：${reason}`,
    timestamp: new Date().toISOString()
  };
  auditLogs.push(log);

  return { success: true, password };
}

function generatePasswordForOrder(order) {
  const overlapCheck = checkTimeOverlap(
    order.checkIn,
    order.checkOut,
    order.propertyId
  );

  if (overlapCheck.hasOverlap) {
    return {
      success: false,
      message: `订单时间与现有密码冲突：${overlapCheck.conflictingPassword.name}`
    };
  }

  const password = {
    id: uuidv4(),
    propertyId: order.propertyId,
    orderId: order.id,
    type: 'guest',
    code: generateRandomCode(),
    name: `${order.guestName}-入住密码`,
    validFrom: order.checkIn,
    validTo: order.checkOut,
    status: 'pending',
    reason: '未到入住时间，密码暂未生效',
    createdAt: new Date().toISOString()
  };

  passwords.push(password);

  const log = {
    id: uuidv4(),
    propertyId: order.propertyId,
    passwordId: password.id,
    action: 'generate',
    description: `为订单生成入住密码：${order.guestName}`,
    timestamp: new Date().toISOString()
  };
  auditLogs.push(log);

  return { success: true, password };
}

function generateMaintenancePassword(propertyId, validFrom, validTo, reason) {
  const overlapCheck = checkTimeOverlap(
    validFrom,
    validTo,
    propertyId
  );

  if (overlapCheck.hasOverlap) {
    return {
      success: false,
      message: `维修时间与现有密码冲突：${overlapCheck.conflictingPassword.name}`
    };
  }

  const password = {
    id: uuidv4(),
    propertyId,
    orderId: null,
    type: 'maintenance',
    code: generateRandomCode(),
    name: '维修临时密码',
    validFrom,
    validTo,
    status: 'pending',
    reason: reason || '维修期间临时授权',
    createdAt: new Date().toISOString()
  };

  passwords.push(password);

  const log = {
    id: uuidv4(),
    propertyId,
    passwordId: password.id,
    action: 'generate',
    description: '生成维修临时密码',
    timestamp: new Date().toISOString()
  };
  auditLogs.push(log);

  return { success: true, password };
}

function getPasswordStatusReport(propertyId = null) {
  const filteredPasswords = propertyId 
    ? passwords.filter(p => p.propertyId === propertyId)
    : passwords;

  return filteredPasswords.map(pwd => {
    const validation = validatePassword(pwd);
    return {
      ...pwd,
      validation,
      explanation: getExplanation(pwd, validation)
    };
  });
}

function getExplanation(password, validation) {
  const explanations = [];
  
  explanations.push(`密码类型：${getTypeDescription(password.type)}`);
  explanations.push(`有效期：${new Date(password.validFrom).toLocaleString()} 至 ${new Date(password.validTo).toLocaleString()}`);
  explanations.push(`当前状态：${getStatusDescription(validation.status)}`);
  explanations.push(`状态说明：${validation.reason}`);
  
  if (password.type === 'maintenance') {
    explanations.push('⚠️ 维修密码仅在房源处于维修状态时可用');
  }
  
  if (password.type === 'guest' && password.orderId) {
    explanations.push('📝 该密码关联订单，退房后自动失效');
  }

  return explanations.join(' | ');
}

function getTypeDescription(type) {
  const types = {
    guest: '客人入住密码',
    cleaning: '保洁密码',
    maintenance: '维修临时密码'
  };
  return types[type] || type;
}

function getStatusDescription(status) {
  const statuses = {
    active: '✅ 生效中',
    pending: '⏳ 待生效',
    expired: '❌ 已过期',
    revoked: '🚫 已作废'
  };
  return statuses[status] || status;
}

module.exports = {
  generateRandomCode,
  checkTimeOverlap,
  validatePassword,
  checkMaintenanceAccess,
  checkExpiredPasswordAttempt,
  extendPasswordExpiry,
  revokePassword,
  generatePasswordForOrder,
  generateMaintenancePassword,
  getPasswordStatusReport
};
