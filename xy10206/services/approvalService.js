const { database, generateId } = require('../models/database');
const { PresetStatus, ApprovalStatus } = require('../models/types');
const { createBusinessError } = require('./errors');
const { validateSubmitForApproval, validateApprovalDecision } = require('./validators');

const getAllApprovals = (sceneId) => {
  let approvals = Array.from(database.approvals.values());
  if (sceneId) {
    approvals = approvals.filter(a => {
      const preset = database.presets.get(a.presetId);
      return preset && preset.sceneId === sceneId;
    });
  }
  return approvals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const getApprovalById = (approvalId) => {
  const approval = database.approvals.get(approvalId);
  if (!approval) {
    throw createBusinessError.approvalNotFound(approvalId);
  }
  const preset = database.presets.get(approval.presetId);
  return {
    ...approval,
    preset: preset || null
  };
};

const submitForApproval = (data) => {
  validateSubmitForApproval(data);
  
  const preset = database.presets.get(data.presetId);
  if (!preset) {
    throw createBusinessError.presetNotFound(data.presetId);
  }
  
  if (preset.status !== PresetStatus.DRAFT && preset.status !== PresetStatus.PENDING) {
    throw createBusinessError.invalidPresetStatus(preset.status, [PresetStatus.DRAFT, PresetStatus.PENDING]);
  }
  
  const existingPending = Array.from(database.approvals.values())
    .find(a => a.presetId === data.presetId && a.status === ApprovalStatus.PENDING);
  
  if (existingPending) {
    throw createBusinessError.invalidRequest(`预设【${preset.name}】已有待处理的审批请求，请等待审批完成后再提交`);
  }
  
  preset.status = PresetStatus.PENDING;
  preset.submittedAt = new Date().toISOString();
  preset.submittedBy = data.requestedBy;
  
  const approval = {
    id: generateId('approval'),
    presetId: data.presetId,
    presetVersion: preset.version,
    presetName: preset.name,
    sceneId: preset.sceneId,
    status: ApprovalStatus.PENDING,
    requestedBy: data.requestedBy,
    reason: data.reason,
    createdAt: new Date().toISOString(),
    decidedBy: null,
    decidedAt: null,
    decisionReason: null
  };
  
  database.approvals.set(approval.id, approval);
  
  return {
    approval,
    preset,
    message: `预设【${preset.name}】(${preset.version}) 已提交审批，请等待导演或技术主管审核`
  };
};

const makeApprovalDecision = (data) => {
  validateApprovalDecision(data);
  
  const approval = database.approvals.get(data.approvalId);
  if (!approval) {
    throw createBusinessError.approvalNotFound(data.approvalId);
  }
  
  if (approval.status !== ApprovalStatus.PENDING) {
    throw createBusinessError.invalidRequest(`该审批已被【${approval.decidedBy}】于【${approval.decidedAt}】${approval.status === ApprovalStatus.APPROVED ? '批准' : '拒绝'}`);
  }
  
  const preset = database.presets.get(approval.presetId);
  if (!preset) {
    throw createBusinessError.presetNotFound(approval.presetId);
  }
  
  approval.status = data.decision === 'APPROVE' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
  approval.decidedBy = data.approvedBy;
  approval.decidedAt = new Date().toISOString();
  approval.decisionReason = data.reason || '';
  
  if (data.decision === 'APPROVE') {
    preset.status = PresetStatus.APPROVED;
    preset.approvedBy = data.approvedBy;
    preset.approvedAt = new Date().toISOString();
    return {
      approval,
      preset,
      message: `预设【${preset.name}】(${preset.version}) 已被【${data.approvedBy}】批准，可进入冻结或激活流程`
    };
  } else {
    preset.status = PresetStatus.DRAFT;
    preset.rejectedBy = data.approvedBy;
    preset.rejectedAt = new Date().toISOString();
    preset.rejectReason = data.reason || '';
    return {
      approval,
      preset,
      message: `预设【${preset.name}】(${preset.version}) 已被【${data.approvedBy}】拒绝，请根据审批意见修改后重新提交`
    };
  }
};

module.exports = {
  getAllApprovals,
  getApprovalById,
  submitForApproval,
  makeApprovalDecision
};
