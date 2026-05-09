const { AuditLog } = require('../models');
const { v4: uuidv4 } = require('uuid');

const requestIdMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
};

const auditMiddleware = (action, resourceType) => {
  return async (req, res, next) => {
    const start = Date.now();
    const requestId = req.id;
    
    res.on('finish', async () => {
      try {
        const user = req.user;
        const tenantId = req.tenantId || user?.currentTenantId;
        const duration = Date.now() - start;
        
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
        
        let resourceId = null;
        if (req.params.id) {
          resourceId = req.params.id;
        }
        
        let beforeState = null;
        let afterState = null;
        
        if (req.record && (action === 'UPDATE' || action === 'DELETE')) {
          beforeState = JSON.stringify(req.record.toJSON());
        }
        
        if (res.locals.afterState) {
          afterState = JSON.stringify(res.locals.afterState);
        } else if (res.locals.createdRecord && action === 'CREATE') {
          afterState = JSON.stringify(res.locals.createdRecord);
        }

        await AuditLog.create({
          tenantId: tenantId || '00000000-0000-0000-0000-000000000000',
          userId: user?.id,
          recordId: resourceId,
          action,
          resourceType,
          resourceId,
          beforeState,
          afterState,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          status: isSuccess ? 'success' : 'failure',
          errorMessage: isSuccess ? null : `HTTP ${res.statusCode}`,
          requestId,
          createdAt: new Date()
        });
      } catch (error) {
        console.error('审计日志记录失败:', error);
      }
    });

    next();
  };
};

const logException = async (req, error) => {
  try {
    const user = req.user;
    const tenantId = req.tenantId || user?.currentTenantId;
    
    await AuditLog.create({
      tenantId: tenantId || '00000000-0000-0000-0000-000000000000',
      userId: user?.id,
      action: req.method === 'POST' ? 'CREATE' : 
              req.method === 'PUT' ? 'UPDATE' : 
              req.method === 'DELETE' ? 'DELETE' : 'READ',
      resourceType: req.route?.path || req.path,
      status: 'failure',
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id
    });
  } catch (auditError) {
    console.error('异常审计日志记录失败:', auditError);
  }
};

module.exports = {
  requestIdMiddleware,
  auditMiddleware,
  logException
};
