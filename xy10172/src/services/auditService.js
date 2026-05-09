const AuditLog = require('../models/AuditLog');
const { v4: uuidv4 } = require('uuid');

const AUDIT_ACTIONS = AuditLog.getActions();

function generateOperationId() {
  return `OP-${uuidv4().slice(0, 8).toUpperCase()}-${Date.now()}`;
}

async function createAuditLog(options) {
  const {
    action,
    description,
    contractId,
    contractNo,
    version,
    operator = {},
    previousState = {},
    currentState = {},
    requestId,
    source = 'api',
    details = {},
    success = true,
    errorMessage = null,
    compensationStatus = 'none'
  } = options;

  const operationId = options.operationId || generateOperationId();

  const auditLog = new AuditLog({
    operationId,
    contractId,
    contractNo,
    version,
    action,
    description,
    operator: {
      id: operator.id,
      name: operator.name,
      email: operator.email,
      ip: operator.ip,
      userAgent: operator.userAgent
    },
    previousState: {
      status: previousState.status,
      version: previousState.version,
      parties: previousState.parties,
      metadata: previousState.metadata
    },
    currentState: {
      status: currentState.status,
      version: currentState.version,
      parties: currentState.parties,
      metadata: currentState.metadata
    },
    requestId,
    source,
    details,
    success,
    errorMessage,
    compensationStatus
  });

  await auditLog.save();
  return auditLog;
}

async function logContractCreation(contract, operator, requestId) {
  return createAuditLog({
    action: AUDIT_ACTIONS.CREATE_CONTRACT,
    description: `创建合同 ${contract.contractNo}`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    operator,
    previousState: {},
    currentState: {
      status: contract.status,
      version: contract.currentVersion,
      parties: contract.parties,
      metadata: contract.metadata
    },
    requestId,
    source: 'api'
  });
}

async function logContractUpdate(contract, operator, requestId, previousState) {
  return createAuditLog({
    action: AUDIT_ACTIONS.UPDATE_CONTRACT,
    description: `更新合同 ${contract.contractNo}`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    operator,
    previousState: {
      status: previousState.status,
      version: previousState.version,
      parties: previousState.parties,
      metadata: previousState.metadata
    },
    currentState: {
      status: contract.status,
      version: contract.currentVersion,
      parties: contract.parties,
      metadata: contract.metadata
    },
    requestId,
    source: 'api'
  });
}

async function logInitiateSigning(contract, operator, requestId, previousState) {
  return createAuditLog({
    action: AUDIT_ACTIONS.INITIATE_SIGNING,
    description: `发起合同 ${contract.contractNo} 签署流程`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    operator,
    previousState: {
      status: previousState.status,
      version: previousState.version
    },
    currentState: {
      status: contract.status,
      version: contract.currentVersion
    },
    requestId,
    source: 'api'
  });
}

async function logSign(contract, party, operator, requestId) {
  return createAuditLog({
    action: AUDIT_ACTIONS.SIGN,
    description: `${party.name} 签署了合同 ${contract.contractNo}`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    operator,
    currentState: {
      status: contract.status,
      version: contract.currentVersion,
      parties: contract.parties
    },
    requestId,
    source: 'api',
    details: {
      partyId: party.id,
      partyName: party.name,
      signedAt: party.signedAt
    }
  });
}

async function logReject(contract, party, operator, requestId, reason) {
  return createAuditLog({
    action: AUDIT_ACTIONS.REJECT,
    description: `${party.name} 拒签了合同 ${contract.contractNo}`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    operator,
    currentState: {
      status: contract.status,
      version: contract.currentVersion,
      parties: contract.parties
    },
    requestId,
    source: 'api',
    details: {
      partyId: party.id,
      partyName: party.name,
      reason
    }
  });
}

async function logWithdraw(contract, operator, requestId, reason, previousState) {
  return createAuditLog({
    action: AUDIT_ACTIONS.WITHDRAW,
    description: `撤回合同 ${contract.contractNo}`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    operator,
    previousState: {
      status: previousState.status,
      version: previousState.version
    },
    currentState: {
      status: contract.status,
      version: contract.currentVersion
    },
    requestId,
    source: 'api',
    details: { reason }
  });
}

async function logReinitiate(contract, operator, requestId, previousState) {
  return createAuditLog({
    action: AUDIT_ACTIONS.REINITIATE,
    description: `重新发起合同 ${contract.contractNo} 签署`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    operator,
    previousState: {
      status: previousState.status,
      version: previousState.version
    },
    currentState: {
      status: contract.status,
      version: contract.currentVersion
    },
    requestId,
    source: 'api'
  });
}

async function logSupplementSign(contract, operator, requestId) {
  return createAuditLog({
    action: AUDIT_ACTIONS.SUPPLEMENT_SIGN,
    description: `合同 ${contract.contractNo} 补签流程`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    operator,
    currentState: {
      status: contract.status,
      version: contract.currentVersion
    },
    requestId,
    source: 'api'
  });
}

async function logComplete(contract, operator, requestId) {
  return createAuditLog({
    action: AUDIT_ACTIONS.COMPLETE,
    description: `合同 ${contract.contractNo} 签署完成`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    operator,
    currentState: {
      status: contract.status,
      version: contract.currentVersion
    },
    requestId,
    source: 'system'
  });
}

async function logFreezeVersion(contractVersion, operator, requestId) {
  return createAuditLog({
    action: AUDIT_ACTIONS.FREEZE_VERSION,
    description: `冻结合同 ${contractVersion.contractNo} 版本 v${contractVersion.version}`,
    contractId: contractVersion.contractId,
    contractNo: contractVersion.contractNo,
    version: contractVersion.version,
    operator,
    currentState: {
      version: contractVersion.version
    },
    requestId,
    source: 'system',
    details: {
      freezeReason: contractVersion.freezeReason,
      frozenAt: contractVersion.frozenAt
    }
  });
}

async function logCallbackSuccess(callbackRecord, requestId) {
  return createAuditLog({
    action: AUDIT_ACTIONS.CALLBACK_SUCCESS,
    description: `回调成功: ${callbackRecord.event}`,
    contractId: callbackRecord.contractId,
    contractNo: callbackRecord.contractNo,
    version: callbackRecord.version,
    requestId,
    source: 'callback',
    details: {
      callbackId: callbackRecord.callbackId,
      event: callbackRecord.event,
      callbackUrl: callbackRecord.callbackUrl
    }
  });
}

async function logCallbackFailed(callbackRecord, error, requestId) {
  return createAuditLog({
    action: AUDIT_ACTIONS.CALLBACK_FAILED,
    description: `回调失败: ${callbackRecord.event}`,
    contractId: callbackRecord.contractId,
    contractNo: callbackRecord.contractNo,
    version: callbackRecord.version,
    requestId,
    source: 'callback',
    success: false,
    errorMessage: error.message || error,
    details: {
      callbackId: callbackRecord.callbackId,
      event: callbackRecord.event,
      callbackUrl: callbackRecord.callbackUrl,
      attemptCount: callbackRecord.attemptCount
    }
  });
}

async function logCallbackRetry(callbackRecord, requestId) {
  return createAuditLog({
    action: AUDIT_ACTIONS.CALLBACK_RETRY,
    description: `回调重试: ${callbackRecord.event} (第 ${callbackRecord.attemptCount + 1} 次)`,
    contractId: callbackRecord.contractId,
    contractNo: callbackRecord.contractNo,
    version: callbackRecord.version,
    requestId,
    source: 'system',
    details: {
      callbackId: callbackRecord.callbackId,
      event: callbackRecord.event,
      callbackUrl: callbackRecord.callbackUrl,
      nextRetryAt: callbackRecord.nextRetryAt
    }
  });
}

async function logStatusChange(contract, operator, requestId, previousState) {
  return createAuditLog({
    action: AUDIT_ACTIONS.STATUS_CHANGE,
    description: `合同 ${contract.contractNo} 状态从 ${previousState.status} 变为 ${contract.status}`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    operator,
    previousState: {
      status: previousState.status
    },
    currentState: {
      status: contract.status
    },
    requestId,
    source: 'system'
  });
}

async function logMetadataUpdate(contract, operator, requestId, changes) {
  return createAuditLog({
    action: AUDIT_ACTIONS.METADATA_UPDATE,
    description: `更新合同 ${contract.contractNo} 元数据`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    operator,
    requestId,
    source: 'api',
    details: { changes }
  });
}

async function logCompensation(auditLogId, operator, requestId, compensationOperationId) {
  return createAuditLog({
    action: AUDIT_ACTIONS.COMPENSATION,
    description: `执行补偿操作`,
    requestId,
    source: 'compensation',
    operator,
    details: {
      originalAuditLogId: auditLogId,
      compensationOperationId
    }
  });
}

async function getContractAuditTrail(contractId, options = {}) {
  const { page = 1, limit = 50, action, startDate, endDate } = options;
  
  const query = { contractId };
  
  if (action) {
    query.action = action;
  }
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  const skip = (page - 1) * limit;
  
  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(query)
  ]);
  
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

async function getAuditLogByOperationId(operationId) {
  return AuditLog.findOne({ operationId }).lean();
}

async function updateCompensationStatus(auditLogId, status, compensationOperationId = null) {
  const update = { compensationStatus: status };
  if (compensationOperationId) {
    update.compensationOperationId = compensationOperationId;
  }
  return AuditLog.findByIdAndUpdate(auditLogId, update, { new: true });
}

module.exports = {
  generateOperationId,
  createAuditLog,
  logContractCreation,
  logContractUpdate,
  logInitiateSigning,
  logSign,
  logReject,
  logWithdraw,
  logReinitiate,
  logSupplementSign,
  logComplete,
  logFreezeVersion,
  logCallbackSuccess,
  logCallbackFailed,
  logCallbackRetry,
  logStatusChange,
  logMetadataUpdate,
  logCompensation,
  getContractAuditTrail,
  getAuditLogByOperationId,
  updateCompensationStatus,
  AUDIT_ACTIONS
};
