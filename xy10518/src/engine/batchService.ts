import {
  Batch,
  BatchStatus,
  Defect,
  InspectionRecord,
  ConcessionRequest,
  HistoryEntry,
  ActionType,
  SamplingSheet,
  CommandResult,
  ValidationResult
} from '../types';
import { generateId, getTimestamp } from '../utils/id';
import { saveBatch, getBatch, saveSamplingSheet, getSamplingSheet } from '../utils/store';
import { validateAction, getNextStatus } from './stateMachine';
import {
  evaluateInspection,
  requiresReinspection,
  requiresConcession,
  validateReinspectionSampleCount,
  calculateRiskLevel,
  validateModificationAfterApproval,
  getTotalDefectCount,
  hasCriticalDefect,
  calculateDefectScore
} from './rules';

export function createBatch(params: {
  batchNumber: string;
  productCode: string;
  productName: string;
  quantity: number;
  productionDate: string;
  productionLine: string;
}): CommandResult<Batch> {
  const existing = getBatch(params.batchNumber);
  if (existing) {
    return {
      success: true,
      message: `批次 ${params.batchNumber} 已存在，跳过创建（幂等）`,
      data: existing
    };
  }

  const batch: Batch = {
    id: generateId(),
    batchNumber: params.batchNumber,
    productCode: params.productCode,
    productName: params.productName,
    quantity: params.quantity,
    productionDate: params.productionDate,
    productionLine: params.productionLine,
    status: 'CREATED',
    currentRisk: 'NONE',
    inspections: [],
    concessionRequests: [],
    history: [],
    createdAt: getTimestamp(),
    updatedAt: getTimestamp()
  };

  saveBatch(batch);

  return {
    success: true,
    message: `批次 ${params.batchNumber} 创建成功`,
    data: batch
  };
}

export function recordInitialInspection(params: {
  batchNumber: string;
  sampleCount: number;
  defects: Defect[];
  inspector: string;
  notes?: string;
  sheetNumber: string;
}): CommandResult<Batch> {
  const batch = getBatch(params.batchNumber);
  if (!batch) {
    return {
      success: false,
      message: `批次 ${params.batchNumber} 不存在`,
      errors: [`批次不存在: ${params.batchNumber}`]
    };
  }

  const existingSheet = getSamplingSheet(params.sheetNumber);
  if (existingSheet) {
    return {
      success: true,
      message: `抽样单 ${params.sheetNumber} 已存在，跳过记录（幂等）`,
      data: batch
    };
  }

  if (!validateAction('INITIAL_INSPECT', batch.status)) {
    return {
      success: false,
      message: `批次状态 ${batch.status} 不允许执行初检`,
      errors: [`状态校验失败: 当前状态 ${batch.status}, 允许执行初检的状态: CREATED`]
    };
  }

  const defectCount = getTotalDefectCount(params.defects);
  const result = evaluateInspection(params.defects, params.sampleCount, false);
  const riskLevel = calculateRiskLevel(params.defects);

  const inspection: InspectionRecord = {
    id: generateId(),
    batchId: batch.id,
    sampleCount: params.sampleCount,
    inspectedCount: params.sampleCount,
    defectCount,
    defects: params.defects,
    result,
    inspector: params.inspector,
    timestamp: getTimestamp(),
    notes: params.notes
  };

  const historyEntry: HistoryEntry = {
    id: generateId(),
    batchId: batch.id,
    actionType: 'INITIAL_INSPECT',
    previousStatus: batch.status,
    newStatus: 'INITIAL_INSPECTION',
    actor: params.inspector,
    timestamp: getTimestamp(),
    reason: `初检完成: ${result === 'PASS' ? '通过' : '不合格'}`,
    inspectionId: inspection.id
  };

  let newStatus: BatchStatus = 'INITIAL_INSPECTION';
  if (result === 'PASS') {
    newStatus = 'PASSED';
    historyEntry.newStatus = 'PASSED';
  } else if (requiresConcession(inspection)) {
    newStatus = 'PENDING_CONCESSION';
    historyEntry.newStatus = 'PENDING_CONCESSION';
    historyEntry.reason = '检测到严重缺陷，需要让步放行审批';
  } else if (requiresReinspection(inspection, batch.inspections)) {
    newStatus = 'PENDING_REINSPECTION';
    historyEntry.newStatus = 'PENDING_REINSPECTION';
    historyEntry.reason = '初检不合格，需要复检';
  } else {
    newStatus = 'PENDING_CONCESSION';
    historyEntry.newStatus = 'PENDING_CONCESSION';
    historyEntry.reason = '已完成复检仍不合格，需让步放行或返工审批';
  }

  const samplingSheet: SamplingSheet = {
    id: generateId(),
    batchNumber: params.batchNumber,
    sheetNumber: params.sheetNumber,
    sampleCount: params.sampleCount,
    inspectedCount: params.sampleCount,
    defectCount,
    defects: params.defects,
    result,
    inspector: params.inspector,
    inspectionDate: getTimestamp(),
    notes: params.notes
  };

  batch.inspections.push(inspection);
  batch.history.push(historyEntry);
  batch.status = newStatus;
  batch.currentRisk = riskLevel;
  batch.updatedAt = getTimestamp();

  saveBatch(batch);
  saveSamplingSheet(samplingSheet);

  return {
    success: true,
    message: `初检记录完成，批次状态: ${newStatus}`,
    data: batch
  };
}

export function recordReinspection(params: {
  batchNumber: string;
  sampleCount: number;
  defects: Defect[];
  inspector: string;
  notes?: string;
  sheetNumber: string;
}): CommandResult<Batch> {
  const batch = getBatch(params.batchNumber);
  if (!batch) {
    return {
      success: false,
      message: `批次 ${params.batchNumber} 不存在`,
      errors: [`批次不存在: ${params.batchNumber}`]
    };
  }

  const existingSheet = getSamplingSheet(params.sheetNumber);
  if (existingSheet) {
    return {
      success: true,
      message: `抽样单 ${params.sheetNumber} 已存在，跳过记录（幂等）`,
      data: batch
    };
  }

  if (batch.status !== 'PENDING_REINSPECTION') {
    return {
      success: false,
      message: `批次状态 ${batch.status} 不允许执行复检`,
      errors: [`状态校验失败: 当前状态 ${batch.status}, 允许执行复检的状态: PENDING_REINSPECTION`]
    };
  }

  if (batch.inspections.length === 0) {
    return {
      success: false,
      message: '找不到初检记录',
      errors: ['无法复检: 该批次没有初检记录']
    };
  }

  const initialSampleCount = batch.inspections[0].sampleCount;
  const sampleValidation = validateReinspectionSampleCount(initialSampleCount, params.sampleCount);

  if (!sampleValidation.valid) {
    return {
      success: false,
      message: '复检样本数校验失败',
      errors: sampleValidation.errors,
      warnings: sampleValidation.warnings
    };
  }

  const defectCount = getTotalDefectCount(params.defects);
  const result = evaluateInspection(params.defects, params.sampleCount, true);
  const riskLevel = calculateRiskLevel(params.defects);

  const inspection: InspectionRecord = {
    id: generateId(),
    batchId: batch.id,
    sampleCount: params.sampleCount,
    inspectedCount: params.sampleCount,
    defectCount,
    defects: params.defects,
    result,
    inspector: params.inspector,
    timestamp: getTimestamp(),
    notes: params.notes
  };

  let newStatus: BatchStatus;
  let reason: string;

  if (result === 'PASS') {
    newStatus = 'PASSED';
    reason = '复检通过';
  } else if (requiresConcession(inspection)) {
    newStatus = 'PENDING_CONCESSION';
    reason = '复检发现严重缺陷，需要让步放行审批';
  } else {
    newStatus = 'REINSPECTION';
    reason = '复检不合格，需审批让步放行或返工';
  }

  const historyEntry: HistoryEntry = {
    id: generateId(),
    batchId: batch.id,
    actionType: 'REINSPECT',
    previousStatus: batch.status,
    newStatus,
    actor: params.inspector,
    timestamp: getTimestamp(),
    reason,
    inspectionId: inspection.id
  };

  const samplingSheet: SamplingSheet = {
    id: generateId(),
    batchNumber: params.batchNumber,
    sheetNumber: params.sheetNumber,
    sampleCount: params.sampleCount,
    inspectedCount: params.sampleCount,
    defectCount,
    defects: params.defects,
    result,
    inspector: params.inspector,
    inspectionDate: getTimestamp(),
    notes: params.notes
  };

  batch.inspections.push(inspection);
  batch.history.push(historyEntry);
  batch.status = newStatus;
  batch.currentRisk = riskLevel;
  batch.updatedAt = getTimestamp();

  saveBatch(batch);
  saveSamplingSheet(samplingSheet);

  return {
    success: true,
    message: `复检记录完成，批次状态: ${newStatus}`,
    data: batch,
    warnings: sampleValidation.warnings
  };
}

export function requestConcession(params: {
  batchNumber: string;
  reason: string;
  justification: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  requestedBy: string;
}): CommandResult<Batch> {
  const batch = getBatch(params.batchNumber);
  if (!batch) {
    return {
      success: false,
      message: `批次 ${params.batchNumber} 不存在`,
      errors: [`批次不存在: ${params.batchNumber}`]
    };
  }

  const pendingConcession = batch.concessionRequests.find(c => c.approvalStatus === 'PENDING');
  if (pendingConcession) {
    return {
      success: true,
      message: `已有待审批的让步放行申请，跳过创建（幂等）`,
      data: batch
    };
  }

  if (!validateAction('REQUEST_CONCESSION', batch.status)) {
    return {
      success: false,
      message: `批次状态 ${batch.status} 不允许申请让步放行`,
      errors: [`状态校验失败: 当前状态 ${batch.status}, 允许申请的状态: INITIAL_INSPECTION, REINSPECTION`]
    };
  }

  const concession: ConcessionRequest = {
    id: generateId(),
    batchId: batch.id,
    reason: params.reason,
    justification: params.justification,
    riskLevel: params.riskLevel,
    requestedBy: params.requestedBy,
    requestedAt: getTimestamp(),
    approvalStatus: 'PENDING'
  };

  const historyEntry: HistoryEntry = {
    id: generateId(),
    batchId: batch.id,
    actionType: 'REQUEST_CONCESSION',
    previousStatus: batch.status,
    newStatus: 'PENDING_CONCESSION',
    actor: params.requestedBy,
    timestamp: getTimestamp(),
    reason: `申请让步放行: ${params.reason}`,
    concessionId: concession.id
  };

  batch.concessionRequests.push(concession);
  batch.history.push(historyEntry);
  batch.status = 'PENDING_CONCESSION';
  batch.updatedAt = getTimestamp();

  saveBatch(batch);

  return {
    success: true,
    message: `让步放行申请已创建，等待审批`,
    data: batch
  };
}

export function approveConcession(params: {
  batchNumber: string;
  approvedBy: string;
  approvalNotes?: string;
}): CommandResult<Batch> {
  const batch = getBatch(params.batchNumber);
  if (!batch) {
    return {
      success: false,
      message: `批次 ${params.batchNumber} 不存在`,
      errors: [`批次不存在: ${params.batchNumber}`]
    };
  }

  const pendingConcession = batch.concessionRequests.find(c => c.approvalStatus === 'PENDING');
  if (!pendingConcession) {
    const approved = batch.concessionRequests.find(c => c.approvalStatus === 'APPROVED');
    if (approved) {
      return {
        success: true,
        message: `让步放行已被 ${approved.approvedBy} 批准，跳过（幂等）`,
        data: batch
      };
    }
    return {
      success: false,
      message: '没有待审批的让步放行申请',
      errors: ['无法批准: 该批次没有待审批的让步放行申请']
    };
  }

  if (batch.status !== 'PENDING_CONCESSION') {
    return {
      success: false,
      message: `批次状态 ${batch.status} 不允许审批让步放行`,
      errors: [`状态校验失败: 当前状态 ${batch.status}`]
    };
  }

  pendingConcession.approvalStatus = 'APPROVED';
  pendingConcession.approvedBy = params.approvedBy;
  pendingConcession.approvedAt = getTimestamp();
  pendingConcession.approvalNotes = params.approvalNotes;

  const historyEntry: HistoryEntry = {
    id: generateId(),
    batchId: batch.id,
    actionType: 'APPROVE_CONCESSION',
    previousStatus: batch.status,
    newStatus: 'CONCESSION_APPROVED',
    actor: params.approvedBy,
    timestamp: getTimestamp(),
    reason: `让步放行已批准${params.approvalNotes ? `: ${params.approvalNotes}` : ''}`,
    concessionId: pendingConcession.id
  };

  batch.history.push(historyEntry);
  batch.status = 'CONCESSION_APPROVED';
  batch.updatedAt = getTimestamp();

  saveBatch(batch);

  return {
    success: true,
    message: `让步放行已由 ${params.approvedBy} 批准`,
    data: batch
  };
}

export function approveRework(params: {
  batchNumber: string;
  approvedBy: string;
  reason: string;
}): CommandResult<Batch> {
  const batch = getBatch(params.batchNumber);
  if (!batch) {
    return {
      success: false,
      message: `批次 ${params.batchNumber} 不存在`,
      errors: [`批次不存在: ${params.batchNumber}`]
    };
  }

  if (batch.status === 'REWORK') {
    return {
      success: true,
      message: `批次已处于返工状态，跳过（幂等）`,
      data: batch
    };
  }

  if (!validateAction('APPROVE_REWORK', batch.status)) {
    return {
      success: false,
      message: `批次状态 ${batch.status} 不允许批准返工`,
      errors: [`状态校验失败: 当前状态 ${batch.status}, 允许批准返工的状态: REINSPECTION, PENDING_CONCESSION`]
    };
  }

  const historyEntry: HistoryEntry = {
    id: generateId(),
    batchId: batch.id,
    actionType: 'APPROVE_REWORK',
    previousStatus: batch.status,
    newStatus: 'REWORK',
    actor: params.approvedBy,
    timestamp: getTimestamp(),
    reason: params.reason
  };

  batch.history.push(historyEntry);
  batch.status = 'REWORK';
  batch.updatedAt = getTimestamp();

  saveBatch(batch);

  return {
    success: true,
    message: `返工已由 ${params.approvedBy} 批准`,
    data: batch
  };
}

export function closeBatch(params: {
  batchNumber: string;
  closedBy: string;
  reason?: string;
}): CommandResult<Batch> {
  const batch = getBatch(params.batchNumber);
  if (!batch) {
    return {
      success: false,
      message: `批次 ${params.batchNumber} 不存在`,
      errors: [`批次不存在: ${params.batchNumber}`]
    };
  }

  if (batch.status === 'CLOSED') {
    return {
      success: true,
      message: `批次已关闭，跳过（幂等）`,
      data: batch
    };
  }

  if (!validateAction('CLOSE_BATCH', batch.status)) {
    return {
      success: false,
      message: `批次状态 ${batch.status} 不允许关闭`,
      errors: [`状态校验失败: 当前状态 ${batch.status}`]
    };
  }

  const historyEntry: HistoryEntry = {
    id: generateId(),
    batchId: batch.id,
    actionType: 'CLOSE_BATCH',
    previousStatus: batch.status,
    newStatus: 'CLOSED',
    actor: params.closedBy,
    timestamp: getTimestamp(),
    reason: params.reason || '批次处理完成'
  };

  batch.history.push(historyEntry);
  batch.status = 'CLOSED';
  batch.closedAt = getTimestamp();
  batch.updatedAt = getTimestamp();

  saveBatch(batch);

  return {
    success: true,
    message: `批次已由 ${params.closedBy} 关闭`,
    data: batch
  };
}

export function manualCorrection(params: {
  batchNumber: string;
  correctedBy: string;
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}): CommandResult<Batch> {
  const batch = getBatch(params.batchNumber);
  if (!batch) {
    return {
      success: false,
      message: `批次 ${params.batchNumber} 不存在`,
      errors: [`批次不存在: ${params.batchNumber}`]
    };
  }

  const approvalValidation = validateModificationAfterApproval(batch, params.correctedBy);

  const historyEntry: HistoryEntry = {
    id: generateId(),
    batchId: batch.id,
    actionType: 'MANUAL_CORRECTION',
    previousStatus: batch.status,
    newStatus: batch.status,
    actor: params.correctedBy,
    timestamp: getTimestamp(),
    reason: params.reason,
    differences: [{
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue
    }]
  };

  (batch as any)[params.field] = params.newValue;
  batch.history.push(historyEntry);
  batch.updatedAt = getTimestamp();

  saveBatch(batch);

  return {
    success: true,
    message: `人工修正已记录`,
    data: batch,
    warnings: approvalValidation.warnings
  };
}
