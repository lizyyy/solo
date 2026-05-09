const AuditLog = require('../models/AuditLog');

function getIpAddress(req) {
  return req.ip || req.connection?.remoteAddress || 
    req.headers['x-forwarded-for']?.split(',')[0] || 
    req.headers['x-real-ip'] || 'unknown';
}

async function logAction(options) {
  const {
    action,
    resourceType,
    resourceId = null,
    userId,
    username,
    req = null,
    before = null,
    after = null,
    changes = [],
    status = 'success',
    errorMessage = null,
    description = null,
  } = options;
  
  const auditLog = new AuditLog({
    action,
    resourceType,
    resourceId,
    userId,
    username,
    ipAddress: req ? getIpAddress(req) : null,
    userAgent: req?.headers?.['user-agent'] || null,
    before,
    after,
    changes,
    status,
    errorMessage,
    description,
  });
  
  return auditLog.save();
}

function calculateChanges(before, after) {
  const changes = [];
  
  if (!before || !after) {
    return changes;
  }
  
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  
  for (const key of allKeys) {
    const beforeValue = JSON.stringify(before[key]);
    const afterValue = JSON.stringify(after[key]);
    
    if (beforeValue !== afterValue) {
      changes.push({
        field: key,
        before: before[key],
        after: after[key],
      });
    }
  }
  
  return changes;
}

async function getAuditLogs(filters = {}, page = 1, limit = 20) {
  const query = {};
  
  if (filters.action) {
    query.action = filters.action;
  }
  
  if (filters.userId) {
    query.userId = filters.userId;
  }
  
  if (filters.resourceType) {
    query.resourceType = filters.resourceType;
  }
  
  if (filters.resourceId) {
    query.resourceId = filters.resourceId;
  }
  
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.createdAt.$lte = new Date(filters.endDate);
    }
  }
  
  const skip = (page - 1) * limit;
  
  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);
  
  return { logs, total };
}

module.exports = {
  logAction,
  calculateChanges,
  getAuditLogs,
};
