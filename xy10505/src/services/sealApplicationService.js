const db = require('../database');
const { generateId, compareObjects } = require('../utils');
const config = require('../config');
const contractService = require('./contractService');
const riskEngine = require('./riskEngine');

function getApplicationById(id) {
  return db.runGet('SELECT * FROM seal_applications WHERE id = ?', [id]);
}

function getApplicationsByContract(contractId) {
  return db.runAll(`SELECT * FROM seal_applications WHERE contract_id = ? ORDER BY created_at DESC`, [contractId]);
}

function createApplication(data) {
  let contractId = data.contractId;

  if (data.contract) {
    if (contractId) {
      contractService.updateContract(contractId, data.contract, data.applicant);
    } else {
      const contract = contractService.createContract(data.contract);
      contractId = contract.id;
    }
  }

  if (!contractId) {
    throw new Error('必须提供合同ID或合同信息');
  }

  const contract = contractService.getContractById(contractId);
  if (!contract) {
    throw new Error(`合同不存在: ${contractId}`);
  }

  if (!data.sealType || !config.sealTypes[data.sealType]) {
    throw new Error(`无效的印章类型: ${data.sealType}`);
  }

  if (!data.applicant) {
    throw new Error('必须提供申请人');
  }

  const existingApps = getApplicationsByContract(contractId);
  const id = generateId();
  const idempotencyKey = data.idempotencyKey || `APP-${Date.now()}`;

  let originalApplicationId = null;
  let resubmitCount = 0;

  if (data.resubmitFrom) {
    originalApplicationId = data.resubmitFrom;
    const originalApp = getApplicationById(originalApplicationId);
    if (originalApp) {
      resubmitCount = originalApp.resubmit_count + 1;
    }
  }

  const approvers = data.approvers || buildDefaultApprovers(contract, data);

  db.runExec(`
    INSERT INTO seal_applications 
    (id, idempotency_key, contract_id, seal_type, applicant, department, reason, 
     status, current_approver_index, total_approvers, is_withdrawn, 
     original_application_id, resubmit_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, idempotencyKey, contractId, data.sealType, data.applicant, data.department || '未指定部门', data.reason || '', config.approvalStatus.DRAFT, 0, approvers.length, 0, originalApplicationId, resubmitCount]);

  saveApprovalChain(id, approvers);

  recordStatusChange(id, null, config.approvalStatus.DRAFT, data.applicant, 'CREATE', '创建用章申请', JSON.stringify({
    contractName: contract.name,
    sealType: config.sealTypes[data.sealType],
  }));

  if (originalApplicationId) {
    const originalApp = getApplicationById(originalApplicationId);
    if (originalApp) {
      const originalContract = contractService.getContractById(originalApp.contract_id);
      const fieldChanges = compareObjects(originalContract, contract);
      
      for (const change of fieldChanges) {
        recordFieldChange(id, change.field, JSON.stringify(change.oldValue), JSON.stringify(change.newValue), data.applicant);
      }
      
      if (fieldChanges.length === 0) {
        recordFieldChange(id, 'resubmit_note', '无字段变更', '撤回后重新提交', data.applicant);
      }
    }
  }

  const application = getApplicationById(id);
  const riskResult = riskEngine.runRiskScan(application, contract, existingApps);

  return {
    application,
    contract,
    riskScan: riskResult,
    approvalChain: getApprovalChain(id),
  };
}

function buildDefaultApprovers(contract, data) {
  const approvers = [];
  
  approvers.push({
    approver: data.departmentManager || '部门经理-张三',
    role: 'DEPARTMENT_MANAGER',
    order: 1,
  });

  approvers.push({
    approver: data.financialManager || '财务经理-李四',
    role: 'FINANCIAL_MANAGER',
    order: 2,
  });

  if (contract.amount > config.riskThreshold.amount) {
    approvers.push({
      approver: data.generalManager || '总经理-王五',
      role: 'GENERAL_MANAGER',
      order: 3,
    });
  }

  return approvers;
}

function saveApprovalChain(applicationId, approvers) {
  for (const approver of approvers) {
    db.runExec(`
      INSERT INTO approval_chains 
      (id, application_id, approver_order, approver, role)
      VALUES (?, ?, ?, ?, ?)
    `, [generateId(), applicationId, approver.order, approver.approver, approver.role]);
  }
}

function getApprovalChain(applicationId) {
  return db.runAll(`SELECT * FROM approval_chains WHERE application_id = ? ORDER BY approver_order ASC`, [applicationId]);
}

function recordStatusChange(applicationId, fromStatus, toStatus, operator, action, comment, details = null) {
  db.runExec(`
    INSERT INTO status_history 
    (id, application_id, from_status, to_status, operator, action, comment, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [generateId(), applicationId, fromStatus, toStatus, operator, action, comment, details]);
}

function recordFieldChange(applicationId, fieldName, oldValue, newValue, operator) {
  db.runExec(`
    INSERT INTO field_change_history 
    (id, application_id, field_name, old_value, new_value, operator)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [generateId(), applicationId, fieldName, oldValue, newValue, operator]);
}

function getStatusHistory(applicationId) {
  return db.runAll(`SELECT * FROM status_history WHERE application_id = ? ORDER BY created_at ASC`, [applicationId]);
}

function getFieldChangeHistory(applicationId) {
  return db.runAll(`SELECT * FROM field_change_history WHERE application_id = ? ORDER BY created_at ASC`, [applicationId]);
}

function submitApplication(applicationId, operator) {
  const application = getApplicationById(applicationId);
  if (!application) {
    throw new Error(`用章申请不存在: ${applicationId}`);
  }

  if (application.status !== config.approvalStatus.DRAFT) {
    throw new Error(`当前状态 ${application.status} 不允许提交`);
  }

  const contract = contractService.getContractById(application.contract_id);
  const existingApps = getApplicationsByContract(application.contract_id);
  const riskResult = riskEngine.runRiskScan(application, contract, existingApps);

  const blockingRisks = riskResult.criticalRisks.filter(r => 
    !r.ruleName.includes('subject_change_check')
  );
  if (blockingRisks.length > 0) {
    throw new Error(`存在严重风险，无法提交: ${blockingRisks[0].riskReason}`);
  }

  db.runExec(`UPDATE seal_applications SET status = ?, current_approver_index = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [config.approvalStatus.PENDING, applicationId]);
  db.runExec(`UPDATE approval_chains SET status = ? WHERE application_id = ? AND approver_order = 1`, ['APPROVING', applicationId]);

  recordStatusChange(applicationId, config.approvalStatus.DRAFT, config.approvalStatus.PENDING, operator, 'SUBMIT', '提交审批', null);

  return {
    application: getApplicationById(applicationId),
    approvalChain: getApprovalChain(applicationId),
    riskScan: riskResult,
  };
}

function approveStep(applicationId, approver, comment = '') {
  const application = getApplicationById(applicationId);
  if (!application) {
    throw new Error(`用章申请不存在: ${applicationId}`);
  }

  const approvalChain = getApprovalChain(applicationId);
  const currentIndex = application.current_approver_index;
  const currentStep = approvalChain.find(s => s.approver_order === currentIndex);

  if (!currentStep) {
    throw new Error('没有待审批的步骤');
  }

  if (currentStep.approver !== approver) {
    throw new Error(`当前审批人应为 ${currentStep.approver}，而不是 ${approver}`);
  }

  if (currentStep.status !== 'APPROVING') {
    throw new Error(`当前步骤状态为 ${currentStep.status}，无法审批`);
  }

  db.runExec(`UPDATE approval_chains SET status = ?, approved_at = CURRENT_TIMESTAMP, comment = ? WHERE id = ?`, ['APPROVED', comment, currentStep.id]);

  const nextIndex = currentIndex + 1;
  const nextStep = approvalChain.find(s => s.approver_order === nextIndex);

  let newStatus = application.status;
  let newApproverIndex = currentIndex;

  if (nextStep) {
    newStatus = config.approvalStatus.APPROVING;
    newApproverIndex = nextIndex;
    db.runExec(`UPDATE approval_chains SET status = ? WHERE id = ?`, ['APPROVING', nextStep.id]);
  } else {
    newStatus = config.approvalStatus.APPROVED;
    newApproverIndex = 0;
  }

  db.runExec(`UPDATE seal_applications SET status = ?, current_approver_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, newApproverIndex, applicationId]);

  recordStatusChange(applicationId, application.status, newStatus, approver, 'APPROVE', comment || '审批通过', JSON.stringify({ step: currentIndex }));

  return {
    application: getApplicationById(applicationId),
    approvalChain: getApprovalChain(applicationId),
    currentStep: { ...currentStep, status: 'APPROVED' },
    nextStep: nextStep || null,
  };
}

function rejectStep(applicationId, approver, reason) {
  const application = getApplicationById(applicationId);
  if (!application) {
    throw new Error(`用章申请不存在: ${applicationId}`);
  }

  const approvalChain = getApprovalChain(applicationId);
  const currentIndex = application.current_approver_index;
  const currentStep = approvalChain.find(s => s.approver_order === currentIndex);

  if (!currentStep) {
    throw new Error('没有待审批的步骤');
  }

  if (currentStep.approver !== approver) {
    throw new Error(`当前审批人应为 ${currentStep.approver}，而不是 ${approver}`);
  }

  db.runExec(`UPDATE approval_chains SET status = ?, rejected_at = CURRENT_TIMESTAMP, comment = ? WHERE id = ?`, ['REJECTED', reason, currentStep.id]);
  db.runExec(`UPDATE seal_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [config.approvalStatus.REJECTED, applicationId]);

  recordStatusChange(applicationId, application.status, config.approvalStatus.REJECTED, approver, 'REJECT', reason, JSON.stringify({ step: currentIndex }));

  return {
    application: getApplicationById(applicationId),
    approvalChain: getApprovalChain(applicationId),
    rejectedStep: currentStep,
  };
}

function withdrawApplication(applicationId, operator, reason) {
  const application = getApplicationById(applicationId);
  if (!application) {
    throw new Error(`用章申请不存在: ${applicationId}`);
  }

  const validStatuses = [
    config.approvalStatus.DRAFT,
    config.approvalStatus.PENDING,
    config.approvalStatus.APPROVING,
  ];

  if (!validStatuses.includes(application.status)) {
    throw new Error(`当前状态 ${application.status} 不允许撤回`);
  }

  db.runExec(`
    UPDATE seal_applications 
    SET status = ?, is_withdrawn = 1, withdrawn_at = CURRENT_TIMESTAMP, 
        withdrawn_by = ?, withdraw_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [config.approvalStatus.WITHDRAWN, operator, reason, applicationId]);

  db.runExec(`UPDATE approval_chains SET status = ? WHERE application_id = ? AND status = 'APPROVING'`, ['PENDING', applicationId]);

  recordStatusChange(applicationId, application.status, config.approvalStatus.WITHDRAWN, operator, 'WITHDRAW', reason, null);

  return {
    application: getApplicationById(applicationId),
    approvalChain: getApprovalChain(applicationId),
  };
}

function confirmSeal(applicationId, operator, sealCount = 1, remark = '') {
  const application = getApplicationById(applicationId);
  if (!application) {
    throw new Error(`用章申请不存在: ${applicationId}`);
  }

  if (application.status !== config.approvalStatus.APPROVED) {
    throw new Error(`当前状态 ${application.status} 不允许用章`);
  }

  const contract = contractService.getContractById(application.contract_id);
  const riskScan = riskEngine.getLatestRiskScan(applicationId);

  if (riskScan && !riskScan.allPassed) {
    const criticalRisks = riskScan.results.filter(r => 
      r.risk_level === config.riskLevels.CRITICAL && 
      r.is_pass === 0 &&
      r.rule_name !== 'subject_change_check'
    );
    if (criticalRisks.length > 0) {
      throw new Error(`存在未解决的严重风险，无法用章: ${criticalRisks[0].risk_reason}`);
    }
  }

  const confirmationId = generateId();
  db.runExec(`
    INSERT INTO seal_confirmations 
    (id, application_id, sealed_by, seal_count, remark)
    VALUES (?, ?, ?, ?, ?)
  `, [confirmationId, applicationId, operator, sealCount, remark]);

  db.runExec(`UPDATE seal_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [config.approvalStatus.SEALED, applicationId]);

  recordStatusChange(applicationId, application.status, config.approvalStatus.SEALED, operator, 'SEAL_CONFIRM', `用章确认，盖章${sealCount}份`, JSON.stringify({ sealCount, remark }));

  return {
    application: getApplicationById(applicationId),
    confirmation: db.runGet('SELECT * FROM seal_confirmations WHERE id = ?', [confirmationId]),
  };
}

function resubmitApplication(originalApplicationId, data) {
  const original = getApplicationById(originalApplicationId);
  if (!original) {
    throw new Error(`原始申请不存在: ${originalApplicationId}`);
  }

  if (original.status !== config.approvalStatus.WITHDRAWN && 
      original.status !== config.approvalStatus.REJECTED) {
    throw new Error('只有已撤回或已驳回的申请可以重提');
  }

  const originalContract = contractService.getContractById(original.contract_id);

  const contractData = data.contract || {
    name: originalContract.name,
    category: originalContract.category,
    amount: originalContract.amount,
    currency: originalContract.amount_currency,
    partyA: originalContract.party_a,
    partyB: originalContract.party_b,
  };

  const newContract = contractService.createContract(contractData);

  return createApplication({
    ...data,
    resubmitFrom: originalApplicationId,
    contractId: newContract.id,
    sealType: data.sealType || original.seal_type,
    applicant: data.applicant || original.applicant,
    department: data.department || original.department,
    reason: data.reason || original.reason,
    contract: contractData,
  });
}

function getApplicationDetail(applicationId) {
  const application = getApplicationById(applicationId);
  if (!application) return null;

  const contract = contractService.getContractById(application.contract_id);
  const approvalChain = getApprovalChain(applicationId);
  const statusHistory = getStatusHistory(applicationId);
  const fieldChanges = getFieldChangeHistory(applicationId);
  const riskHistory = riskEngine.getApplicationRiskHistory(applicationId);
  const latestRisk = riskEngine.getLatestRiskScan(applicationId);

  let originalApplication = null;
  if (application.original_application_id) {
    originalApplication = getApplicationById(application.original_application_id);
  }

  const relatedApplications = getApplicationsByContract(application.contract_id);

  return {
    application,
    contract,
    approvalChain,
    statusHistory,
    fieldChanges,
    riskHistory,
    latestRisk,
    originalApplication,
    relatedApplications,
  };
}

function getApplications(filters = {}, limit = 100, offset = 0) {
  const conditions = [];
  const values = [];

  if (filters.status) {
    conditions.push('status = ?');
    values.push(filters.status);
  }
  if (filters.applicant) {
    conditions.push('applicant = ?');
    values.push(filters.applicant);
  }
  if (filters.contractId) {
    conditions.push('contract_id = ?');
    values.push(filters.contractId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return db.runAll(`SELECT * FROM seal_applications ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...values, limit, offset]);
}

module.exports = {
  createApplication,
  submitApplication,
  approveStep,
  rejectStep,
  withdrawApplication,
  confirmSeal,
  resubmitApplication,
  getApplicationById,
  getApplicationDetail,
  getApplications,
  getApplicationsByContract,
  getApprovalChain,
  getStatusHistory,
  getFieldChangeHistory,
};
