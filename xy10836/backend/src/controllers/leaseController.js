const { LeaseService } = require('../services/LeaseService');

function getOperator(req) {
  return req.body.operator || req.query.operator || req.headers['x-operator'] || 'SYSTEM';
}

function logAudit(action, leaseId, details, result = 'success') {
  try {
    const { LeaseService: service } = require('../services/LeaseService');
    service.logAudit(action, leaseId, { ...details, result });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

function handleError(res, error, action, leaseId, input) {
  console.error(error);
  logAudit(action, leaseId, {
    input,
    error: error.message,
    operator: getOperator(res.req || {})
  }, 'failed');
  res.status(400).json({
    success: false,
    error: error.message
  });
}

function successResponse(res, data, message = '操作成功') {
  res.json({
    success: true,
    message,
    data
  });
}

exports.createLease = (req, res) => {
  const input = {
    applicant: req.body.applicant,
    resourceId: req.body.resourceId,
    durationHours: req.body.durationHours,
    approvalStrategy: req.body.approvalStrategy,
    reason: req.body.reason,
    operator: getOperator(req)
  };

  if (!input.applicant || !input.resourceId || !input.durationHours) {
    const error = '缺少必填参数: applicant, resourceId, durationHours';
    logAudit('LEASE_CREATE_FAILED', null, {
      input,
      error,
      operator: input.operator
    }, 'failed');
    return res.status(400).json({
      success: false,
      error
    });
  }

  try {
    const lease = LeaseService.createLease(
      input.applicant,
      input.resourceId,
      input.durationHours,
      input.approvalStrategy,
      input.reason,
      input.operator
    );
    successResponse(res, lease, '租约创建成功');
  } catch (error) {
    handleError(res, error, 'LEASE_CREATE_FAILED', null, input);
  }
};

exports.getLeases = (req, res) => {
  const input = {
    applicant: req.query.applicant,
    resourceId: req.query.resourceId,
    status: req.query.status,
    operator: getOperator(req)
  };

  try {
    const leases = LeaseService.getLeases(input);
    logAudit('LEASES_QUERIED', null, {
      input,
      resultCount: leases.length,
      operator: input.operator
    }, 'success');
    successResponse(res, leases);
  } catch (error) {
    handleError(res, error, 'LEASES_QUERY_FAILED', null, input);
  }
};

exports.getLeaseById = (req, res) => {
  const input = {
    id: req.params.id,
    operator: getOperator(req)
  };

  try {
    const lease = LeaseService.getLeaseById(input.id);
    
    if (!lease) {
      const error = '租约不存在';
      logAudit('LEASE_GET_FAILED', input.id, {
        input,
        error,
        operator: input.operator
      }, 'failed');
      return res.status(404).json({
        success: false,
        error
      });
    }
    
    const history = LeaseService.getLeaseHistory(input.id);
    logAudit('LEASE_DETAIL_VIEWED', input.id, {
      input,
      operator: input.operator
    }, 'success');
    successResponse(res, { ...lease, history });
  } catch (error) {
    handleError(res, error, 'LEASE_GET_FAILED', input.id, input);
  }
};

exports.approveLease = (req, res) => {
  const input = {
    id: req.params.id,
    approver: req.body.approver,
    comment: req.body.comment,
    operator: req.body.approver || getOperator(req)
  };

  if (!input.approver) {
    const error = '缺少审批人信息';
    logAudit('LEASE_APPROVE_FAILED', input.id, {
      input,
      error,
      operator: input.operator
    }, 'failed');
    return res.status(400).json({
      success: false,
      error
    });
  }

  try {
    const lease = LeaseService.approveLease(input.id, input.approver, input.comment);
    successResponse(res, lease, '租约审批通过');
  } catch (error) {
    handleError(res, error, 'LEASE_APPROVE_FAILED', input.id, input);
  }
};

exports.rejectLease = (req, res) => {
  const input = {
    id: req.params.id,
    rejector: req.body.rejector,
    reason: req.body.reason,
    operator: req.body.rejector || getOperator(req)
  };

  if (!input.rejector) {
    const error = '缺少拒绝人信息';
    logAudit('LEASE_REJECT_FAILED', input.id, {
      input,
      error,
      operator: input.operator
    }, 'failed');
    return res.status(400).json({
      success: false,
      error
    });
  }

  try {
    const lease = LeaseService.rejectLease(input.id, input.rejector, input.reason);
    successResponse(res, lease, '租约已拒绝');
  } catch (error) {
    handleError(res, error, 'LEASE_REJECT_FAILED', input.id, input);
  }
};

exports.requestRenewal = (req, res) => {
  const input = {
    id: req.params.id,
    durationHours: req.body.durationHours,
    applicant: req.body.applicant,
    reason: req.body.reason,
    operator: req.body.applicant || getOperator(req)
  };

  if (!input.durationHours || !input.applicant) {
    const error = '缺少必填参数: durationHours, applicant';
    logAudit('RENEWAL_REQUEST_FAILED', input.id, {
      input,
      error,
      operator: input.operator
    }, 'failed');
    return res.status(400).json({
      success: false,
      error
    });
  }

  try {
    const result = LeaseService.requestRenewal(input.id, input.durationHours, input.applicant, input.reason);
    successResponse(res, result, '续租申请已提交，等待审批');
  } catch (error) {
    handleError(res, error, 'RENEWAL_REQUEST_FAILED', input.id, input);
  }
};

exports.approveRenewal = (req, res) => {
  const input = {
    renewalId: req.params.renewalId,
    approver: req.body.approver,
    comment: req.body.comment,
    operator: req.body.approver || getOperator(req)
  };

  if (!input.approver) {
    const error = '缺少审批人信息';
    logAudit('RENEWAL_APPROVE_FAILED', null, {
      input,
      error,
      operator: input.operator
    }, 'failed');
    return res.status(400).json({
      success: false,
      error
    });
  }

  try {
    const result = LeaseService.approveRenewal(input.renewalId, input.approver, input.comment);
    successResponse(res, result, '续租审批通过');
  } catch (error) {
    handleError(res, error, 'RENEWAL_APPROVE_FAILED', null, input);
  }
};

exports.rejectRenewal = (req, res) => {
  const input = {
    renewalId: req.params.renewalId,
    rejector: req.body.rejector,
    reason: req.body.reason,
    operator: req.body.rejector || getOperator(req)
  };

  if (!input.rejector) {
    const error = '缺少拒绝人信息';
    logAudit('RENEWAL_REJECT_FAILED', null, {
      input,
      error,
      operator: input.operator
    }, 'failed');
    return res.status(400).json({
      success: false,
      error
    });
  }

  try {
    const result = LeaseService.rejectRenewal(input.renewalId, input.rejector, input.reason);
    successResponse(res, result, '续租申请已拒绝');
  } catch (error) {
    handleError(res, error, 'RENEWAL_REJECT_FAILED', null, input);
  }
};

exports.renewLease = (req, res) => {
  const input = {
    id: req.params.id,
    durationHours: req.body.durationHours,
    operator: req.body.operator || getOperator(req)
  };

  if (!input.durationHours) {
    const error = '缺少续时时长';
    logAudit('LEASE_RENEW_FAILED', input.id, {
      input,
      error,
      operator: input.operator
    }, 'failed');
    return res.status(400).json({
      success: false,
      error
    });
  }

  try {
    const lease = LeaseService.renewLease(input.id, input.durationHours, input.operator);
    successResponse(res, lease, '租约续租成功');
  } catch (error) {
    handleError(res, error, 'LEASE_RENEW_FAILED', input.id, input);
  }
};

exports.revokeLease = (req, res) => {
  const input = {
    id: req.params.id,
    operator: req.body.operator,
    reason: req.body.reason
  };

  if (!input.operator) {
    const error = '缺少操作人信息';
    logAudit('LEASE_REVOKE_FAILED', input.id, {
      input,
      error,
      operator: input.operator
    }, 'failed');
    return res.status(400).json({
      success: false,
      error
    });
  }

  try {
    const lease = LeaseService.revokeLease(input.id, input.operator, input.reason);
    successResponse(res, lease, '租约已吊销');
  } catch (error) {
    handleError(res, error, 'LEASE_REVOKE_FAILED', input.id, input);
  }
};

exports.checkExpiredLeases = (req, res) => {
  const input = {
    operator: getOperator(req)
  };

  try {
    const expiredCount = LeaseService.checkExpiredLeases();
    logAudit('EXPIRED_CHECKED', null, {
      input,
      expiredCount,
      operator: input.operator
    }, 'success');
    successResponse(res, { expiredCount }, `已处理 ${expiredCount} 个过期租约`);
  } catch (error) {
    handleError(res, error, 'EXPIRED_CHECK_FAILED', null, input);
  }
};

exports.validateLease = (req, res) => {
  const input = {
    secretToken: req.body.secretToken,
    resourceId: req.body.resourceId,
    operator: req.body.operator || getOperator(req)
  };

  if (!input.secretToken || !input.resourceId) {
    const error = '缺少参数: secretToken, resourceId';
    logAudit('LEASE_VALIDATE_FAILED', null, {
      input,
      error,
      operator: input.operator
    }, 'failed');
    return res.status(400).json({
      success: false,
      error
    });
  }

  try {
    const result = LeaseService.validateLease(input.secretToken, input.resourceId, input.operator);
    successResponse(res, result);
  } catch (error) {
    handleError(res, error, 'LEASE_VALIDATE_FAILED', null, input);
  }
};

exports.getLeaseHistory = (req, res) => {
  const input = {
    id: req.params.id,
    operator: getOperator(req)
  };

  try {
    const history = LeaseService.getLeaseHistory(input.id);
    logAudit('LEASE_HISTORY_VIEWED', input.id, {
      input,
      operator: input.operator
    }, 'success');
    successResponse(res, history);
  } catch (error) {
    handleError(res, error, 'LEASE_HISTORY_FAILED', input.id, input);
  }
};

exports.getPendingRenewals = (req, res) => {
  const input = {
    operator: getOperator(req)
  };

  try {
    const renewals = LeaseService.getPendingRenewals();
    logAudit('PENDING_RENEWALS_VIEWED', null, {
      input,
      count: renewals.length,
      operator: input.operator
    }, 'success');
    successResponse(res, renewals);
  } catch (error) {
    handleError(res, error, 'PENDING_RENEWALS_FAILED', null, input);
  }
};

exports.getInvalidations = (req, res) => {
  const input = {
    operator: getOperator(req)
  };

  try {
    const invalidations = LeaseService.getInvalidations();
    logAudit('INVALIDATIONS_VIEWED', null, {
      input,
      count: invalidations.length,
      operator: input.operator
    }, 'success');
    successResponse(res, invalidations);
  } catch (error) {
    handleError(res, error, 'INVALIDATIONS_FAILED', null, input);
  }
};

exports.getRenewalById = (req, res) => {
  const input = {
    renewalId: req.params.renewalId,
    operator: getOperator(req)
  };

  try {
    const renewal = LeaseService.getRenewalById(input.renewalId);
    if (!renewal) {
      const error = '续租申请不存在';
      logAudit('RENEWAL_GET_FAILED', null, {
        input,
        error,
        operator: input.operator
      }, 'failed');
      return res.status(404).json({
        success: false,
        error
      });
    }
    logAudit('RENEWAL_DETAIL_VIEWED', null, {
      input,
      renewalId: input.renewalId,
      operator: input.operator
    }, 'success');
    successResponse(res, renewal);
  } catch (error) {
    handleError(res, error, 'RENEWAL_GET_FAILED', null, input);
  }
};

exports.exportLeases = (req, res) => {
  const input = {
    operator: getOperator(req)
  };

  try {
    const leases = LeaseService.exportLeases();
    logAudit('LEASES_EXPORTED', null, {
      input,
      exportCount: leases.length,
      operator: input.operator
    }, 'success');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=leases-export.json');
    res.json(leases);
  } catch (error) {
    handleError(res, error, 'LEASE_EXPORT_FAILED', null, input);
  }
};

exports.getAuditLogs = (req, res) => {
  const input = {
    operator: getOperator(req)
  };

  try {
    const logs = LeaseService.getAuditLogs();
    logAudit('AUDIT_LOGS_VIEWED', null, {
      input,
      logCount: logs.length,
      operator: input.operator
    }, 'success');
    successResponse(res, logs);
  } catch (error) {
    handleError(res, error, 'AUDIT_LOGS_FAILED', null, input);
  }
};
