const auditService = require('../services/auditService');

async function getContractAuditTrail(req, res, next) {
  try {
    const { contractId } = req.params;
    const { page = 1, limit = 50, action, startDate, endDate } = req.query;

    const result = await auditService.getContractAuditTrail(contractId, {
      page: parseInt(page),
      limit: parseInt(limit),
      action,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

async function getAuditLogByOperationId(req, res, next) {
  try {
    const { operationId } = req.params;
    const auditLog = await auditService.getAuditLogByOperationId(operationId);

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '审计记录不存在'
        }
      });
    }

    res.json({
      success: true,
      data: auditLog
    });
  } catch (error) {
    next(error);
  }
}

async function getAuditActions(req, res) {
  res.json({
    success: true,
    data: auditService.AUDIT_ACTIONS
  });
}

module.exports = {
  getContractAuditTrail,
  getAuditLogByOperationId,
  getAuditActions
};
