const { LeaseService } = require('../services/LeaseService');

function handleError(res, error) {
  console.error(error);
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
  try {
    const { applicant, resourceId, durationHours, approvalStrategy, reason } = req.body;
    
    if (!applicant || !resourceId || !durationHours) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: applicant, resourceId, durationHours'
      });
    }

    const lease = LeaseService.createLease(applicant, resourceId, durationHours, approvalStrategy, reason);
    successResponse(res, lease, '租约创建成功');
  } catch (error) {
    handleError(res, error);
  }
};

exports.getLeases = (req, res) => {
  try {
    const { applicant, resourceId, status } = req.query;
    const leases = LeaseService.getLeases({ applicant, resourceId, status });
    successResponse(res, leases);
  } catch (error) {
    handleError(res, error);
  }
};

exports.getLeaseById = (req, res) => {
  try {
    const { id } = req.params;
    const lease = LeaseService.getLeaseById(id);
    
    if (!lease) {
      return res.status(404).json({
        success: false,
        error: '租约不存在'
      });
    }
    
    const history = LeaseService.getLeaseHistory(id);
    successResponse(res, { ...lease, history });
  } catch (error) {
    handleError(res, error);
  }
};

exports.approveLease = (req, res) => {
  try {
    const { id } = req.params;
    const { approver, comment } = req.body;
    
    if (!approver) {
      return res.status(400).json({
        success: false,
        error: '缺少审批人信息'
      });
    }

    const lease = LeaseService.approveLease(id, approver, comment);
    successResponse(res, lease, '租约审批通过');
  } catch (error) {
    handleError(res, error);
  }
};

exports.rejectLease = (req, res) => {
  try {
    const { id } = req.params;
    const { rejector, reason } = req.body;
    
    if (!rejector) {
      return res.status(400).json({
        success: false,
        error: '缺少拒绝人信息'
      });
    }

    const lease = LeaseService.rejectLease(id, rejector, reason);
    successResponse(res, lease, '租约已拒绝');
  } catch (error) {
    handleError(res, error);
  }
};

exports.renewLease = (req, res) => {
  try {
    const { id } = req.params;
    const { durationHours } = req.body;
    
    if (!durationHours) {
      return res.status(400).json({
        success: false,
        error: '缺少续时时长'
      });
    }

    const lease = LeaseService.renewLease(id, durationHours);
    successResponse(res, lease, '租约续租成功');
  } catch (error) {
    handleError(res, error);
  }
};

exports.revokeLease = (req, res) => {
  try {
    const { id } = req.params;
    const { operator, reason } = req.body;
    
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '缺少操作人信息'
      });
    }

    const lease = LeaseService.revokeLease(id, operator, reason);
    successResponse(res, lease, '租约已吊销');
  } catch (error) {
    handleError(res, error);
  }
};

exports.checkExpiredLeases = (req, res) => {
  try {
    const expiredCount = LeaseService.checkExpiredLeases();
    successResponse(res, { expiredCount }, `已处理 ${expiredCount} 个过期租约`);
  } catch (error) {
    handleError(res, error);
  }
};

exports.validateLease = (req, res) => {
  try {
    const { secretToken, resourceId } = req.body;
    
    if (!secretToken || !resourceId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: secretToken, resourceId'
      });
    }

    const result = LeaseService.validateLease(secretToken, resourceId);
    successResponse(res, result);
  } catch (error) {
    handleError(res, error);
  }
};

exports.getLeaseHistory = (req, res) => {
  try {
    const { id } = req.params;
    const history = LeaseService.getLeaseHistory(id);
    successResponse(res, history);
  } catch (error) {
    handleError(res, error);
  }
};

exports.exportLeases = (req, res) => {
  try {
    const leases = LeaseService.exportLeases();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=leases-export.json');
    res.json(leases);
  } catch (error) {
    handleError(res, error);
  }
};

exports.getAuditLogs = (req, res) => {
  try {
    const logs = LeaseService.getAuditLogs();
    successResponse(res, logs);
  } catch (error) {
    handleError(res, error);
  }
};
