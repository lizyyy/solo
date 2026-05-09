const { DataRecord, AuditLog, SecurityIncident } = require('../models');

const tenantIsolationMiddleware = async (req, res, next) => {
  const { user, tenantId } = req;
  
  if (!user || !tenantId) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '未认证'
    });
  }

  req.query.tenantId = tenantId;

  const originalJson = res.json.bind(res);
  res.json = function (data) {
    if (data && data.data && Array.isArray(data.data)) {
      const filtered = data.data.filter(item => 
        item.tenantId === undefined || item.tenantId === tenantId
      );
      data.data = filtered;
      if (data.total !== undefined) {
        data.total = filtered.length;
      }
    }
    return originalJson(data);
  };

  next();
};

const verifyRecordTenant = async (req, res, next) => {
  const { user, tenantId, params } = req;
  
  if (!params.id) {
    return next();
  }

  try {
    const record = await DataRecord.findOne({
      where: { id: params.id }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '记录不存在'
      });
    }

    if (record.tenantId !== tenantId) {
      const requestId = req.headers['x-request-id'] || req.id;
      
      await SecurityIncident.create({
        tenantId,
        userId: user.id,
        type: 'CROSS_TENANT_ACCESS',
        severity: 'high',
        description: `检测到跨租户访问尝试`,
        details: JSON.stringify({
          targetRecordId: params.id,
          targetTenantId: record.tenantId,
          currentTenantId: tenantId,
          path: req.path,
          method: req.method
        }),
        ipAddress: req.ip,
        requestId
      });

      await AuditLog.create({
        tenantId,
        userId: user.id,
        recordId: params.id,
        action: 'UNAUTHORIZED_ACCESS',
        resourceType: 'DataRecord',
        resourceId: params.id,
        status: 'failure',
        errorMessage: `跨租户访问阻止: 记录属于租户 ${record.tenantId}，当前租户 ${tenantId}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId
      });

      return res.status(403).json({
        success: false,
        error: 'CROSS_TENANT_ACCESS',
        message: '无权访问其他租户的数据'
      });
    }

    req.record = record;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  tenantIsolationMiddleware,
  verifyRecordTenant
};
