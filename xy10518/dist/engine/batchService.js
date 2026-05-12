"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBatch = createBatch;
exports.recordInitialInspection = recordInitialInspection;
exports.recordReinspection = recordReinspection;
exports.requestConcession = requestConcession;
exports.approveConcession = approveConcession;
exports.approveRework = approveRework;
exports.closeBatch = closeBatch;
exports.manualCorrection = manualCorrection;
const id_1 = require("../utils/id");
const store_1 = require("../utils/store");
const stateMachine_1 = require("./stateMachine");
const rules_1 = require("./rules");
function createBatch(params) {
    const existing = (0, store_1.getBatch)(params.batchNumber);
    if (existing) {
        return {
            success: true,
            message: `批次 ${params.batchNumber} 已存在，跳过创建（幂等）`,
            data: existing
        };
    }
    const batch = {
        id: (0, id_1.generateId)(),
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
        createdAt: (0, id_1.getTimestamp)(),
        updatedAt: (0, id_1.getTimestamp)()
    };
    (0, store_1.saveBatch)(batch);
    return {
        success: true,
        message: `批次 ${params.batchNumber} 创建成功`,
        data: batch
    };
}
function recordInitialInspection(params) {
    const batch = (0, store_1.getBatch)(params.batchNumber);
    if (!batch) {
        return {
            success: false,
            message: `批次 ${params.batchNumber} 不存在`,
            errors: [`批次不存在: ${params.batchNumber}`]
        };
    }
    const existingSheet = (0, store_1.getSamplingSheet)(params.sheetNumber);
    if (existingSheet) {
        return {
            success: true,
            message: `抽样单 ${params.sheetNumber} 已存在，跳过记录（幂等）`,
            data: batch
        };
    }
    if (!(0, stateMachine_1.validateAction)('INITIAL_INSPECT', batch.status)) {
        return {
            success: false,
            message: `批次状态 ${batch.status} 不允许执行初检`,
            errors: [`状态校验失败: 当前状态 ${batch.status}, 允许执行初检的状态: CREATED`]
        };
    }
    const defectCount = (0, rules_1.getTotalDefectCount)(params.defects);
    const result = (0, rules_1.evaluateInspection)(params.defects, params.sampleCount, false);
    const riskLevel = (0, rules_1.calculateRiskLevel)(params.defects);
    const inspection = {
        id: (0, id_1.generateId)(),
        batchId: batch.id,
        sampleCount: params.sampleCount,
        inspectedCount: params.sampleCount,
        defectCount,
        defects: params.defects,
        result,
        inspector: params.inspector,
        timestamp: (0, id_1.getTimestamp)(),
        notes: params.notes
    };
    const historyEntry = {
        id: (0, id_1.generateId)(),
        batchId: batch.id,
        actionType: 'INITIAL_INSPECT',
        previousStatus: batch.status,
        newStatus: 'INITIAL_INSPECTION',
        actor: params.inspector,
        timestamp: (0, id_1.getTimestamp)(),
        reason: `初检完成: ${result === 'PASS' ? '通过' : '不合格'}`,
        inspectionId: inspection.id
    };
    let newStatus = 'INITIAL_INSPECTION';
    if (result === 'PASS') {
        newStatus = 'PASSED';
        historyEntry.newStatus = 'PASSED';
    }
    else if ((0, rules_1.requiresConcession)(inspection)) {
        newStatus = 'PENDING_CONCESSION';
        historyEntry.newStatus = 'PENDING_CONCESSION';
        historyEntry.reason = '检测到严重缺陷，需要让步放行审批';
    }
    else if ((0, rules_1.requiresReinspection)(inspection, batch.inspections)) {
        newStatus = 'PENDING_REINSPECTION';
        historyEntry.newStatus = 'PENDING_REINSPECTION';
        historyEntry.reason = '初检不合格，需要复检';
    }
    else {
        newStatus = 'PENDING_CONCESSION';
        historyEntry.newStatus = 'PENDING_CONCESSION';
        historyEntry.reason = '已完成复检仍不合格，需让步放行或返工审批';
    }
    const samplingSheet = {
        id: (0, id_1.generateId)(),
        batchNumber: params.batchNumber,
        sheetNumber: params.sheetNumber,
        sampleCount: params.sampleCount,
        inspectedCount: params.sampleCount,
        defectCount,
        defects: params.defects,
        result,
        inspector: params.inspector,
        inspectionDate: (0, id_1.getTimestamp)(),
        notes: params.notes
    };
    batch.inspections.push(inspection);
    batch.history.push(historyEntry);
    batch.status = newStatus;
    batch.currentRisk = riskLevel;
    batch.updatedAt = (0, id_1.getTimestamp)();
    (0, store_1.saveBatch)(batch);
    (0, store_1.saveSamplingSheet)(samplingSheet);
    return {
        success: true,
        message: `初检记录完成，批次状态: ${newStatus}`,
        data: batch
    };
}
function recordReinspection(params) {
    const batch = (0, store_1.getBatch)(params.batchNumber);
    if (!batch) {
        return {
            success: false,
            message: `批次 ${params.batchNumber} 不存在`,
            errors: [`批次不存在: ${params.batchNumber}`]
        };
    }
    const existingSheet = (0, store_1.getSamplingSheet)(params.sheetNumber);
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
    const sampleValidation = (0, rules_1.validateReinspectionSampleCount)(initialSampleCount, params.sampleCount);
    if (!sampleValidation.valid) {
        return {
            success: false,
            message: '复检样本数校验失败',
            errors: sampleValidation.errors,
            warnings: sampleValidation.warnings
        };
    }
    const defectCount = (0, rules_1.getTotalDefectCount)(params.defects);
    const result = (0, rules_1.evaluateInspection)(params.defects, params.sampleCount, true);
    const riskLevel = (0, rules_1.calculateRiskLevel)(params.defects);
    const inspection = {
        id: (0, id_1.generateId)(),
        batchId: batch.id,
        sampleCount: params.sampleCount,
        inspectedCount: params.sampleCount,
        defectCount,
        defects: params.defects,
        result,
        inspector: params.inspector,
        timestamp: (0, id_1.getTimestamp)(),
        notes: params.notes
    };
    let newStatus;
    let reason;
    if (result === 'PASS') {
        newStatus = 'PASSED';
        reason = '复检通过';
    }
    else if ((0, rules_1.requiresConcession)(inspection)) {
        newStatus = 'PENDING_CONCESSION';
        reason = '复检发现严重缺陷，需要让步放行审批';
    }
    else {
        newStatus = 'REINSPECTION';
        reason = '复检不合格，需审批让步放行或返工';
    }
    const historyEntry = {
        id: (0, id_1.generateId)(),
        batchId: batch.id,
        actionType: 'REINSPECT',
        previousStatus: batch.status,
        newStatus,
        actor: params.inspector,
        timestamp: (0, id_1.getTimestamp)(),
        reason,
        inspectionId: inspection.id
    };
    const samplingSheet = {
        id: (0, id_1.generateId)(),
        batchNumber: params.batchNumber,
        sheetNumber: params.sheetNumber,
        sampleCount: params.sampleCount,
        inspectedCount: params.sampleCount,
        defectCount,
        defects: params.defects,
        result,
        inspector: params.inspector,
        inspectionDate: (0, id_1.getTimestamp)(),
        notes: params.notes
    };
    batch.inspections.push(inspection);
    batch.history.push(historyEntry);
    batch.status = newStatus;
    batch.currentRisk = riskLevel;
    batch.updatedAt = (0, id_1.getTimestamp)();
    (0, store_1.saveBatch)(batch);
    (0, store_1.saveSamplingSheet)(samplingSheet);
    return {
        success: true,
        message: `复检记录完成，批次状态: ${newStatus}`,
        data: batch,
        warnings: sampleValidation.warnings
    };
}
function requestConcession(params) {
    const batch = (0, store_1.getBatch)(params.batchNumber);
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
    if (!(0, stateMachine_1.validateAction)('REQUEST_CONCESSION', batch.status)) {
        return {
            success: false,
            message: `批次状态 ${batch.status} 不允许申请让步放行`,
            errors: [`状态校验失败: 当前状态 ${batch.status}, 允许申请的状态: INITIAL_INSPECTION, REINSPECTION`]
        };
    }
    const concession = {
        id: (0, id_1.generateId)(),
        batchId: batch.id,
        reason: params.reason,
        justification: params.justification,
        riskLevel: params.riskLevel,
        requestedBy: params.requestedBy,
        requestedAt: (0, id_1.getTimestamp)(),
        approvalStatus: 'PENDING'
    };
    const historyEntry = {
        id: (0, id_1.generateId)(),
        batchId: batch.id,
        actionType: 'REQUEST_CONCESSION',
        previousStatus: batch.status,
        newStatus: 'PENDING_CONCESSION',
        actor: params.requestedBy,
        timestamp: (0, id_1.getTimestamp)(),
        reason: `申请让步放行: ${params.reason}`,
        concessionId: concession.id
    };
    batch.concessionRequests.push(concession);
    batch.history.push(historyEntry);
    batch.status = 'PENDING_CONCESSION';
    batch.updatedAt = (0, id_1.getTimestamp)();
    (0, store_1.saveBatch)(batch);
    return {
        success: true,
        message: `让步放行申请已创建，等待审批`,
        data: batch
    };
}
function approveConcession(params) {
    const batch = (0, store_1.getBatch)(params.batchNumber);
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
    pendingConcession.approvedAt = (0, id_1.getTimestamp)();
    pendingConcession.approvalNotes = params.approvalNotes;
    const historyEntry = {
        id: (0, id_1.generateId)(),
        batchId: batch.id,
        actionType: 'APPROVE_CONCESSION',
        previousStatus: batch.status,
        newStatus: 'CONCESSION_APPROVED',
        actor: params.approvedBy,
        timestamp: (0, id_1.getTimestamp)(),
        reason: `让步放行已批准${params.approvalNotes ? `: ${params.approvalNotes}` : ''}`,
        concessionId: pendingConcession.id
    };
    batch.history.push(historyEntry);
    batch.status = 'CONCESSION_APPROVED';
    batch.updatedAt = (0, id_1.getTimestamp)();
    (0, store_1.saveBatch)(batch);
    return {
        success: true,
        message: `让步放行已由 ${params.approvedBy} 批准`,
        data: batch
    };
}
function approveRework(params) {
    const batch = (0, store_1.getBatch)(params.batchNumber);
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
    if (!(0, stateMachine_1.validateAction)('APPROVE_REWORK', batch.status)) {
        return {
            success: false,
            message: `批次状态 ${batch.status} 不允许批准返工`,
            errors: [`状态校验失败: 当前状态 ${batch.status}, 允许批准返工的状态: REINSPECTION, PENDING_CONCESSION`]
        };
    }
    const historyEntry = {
        id: (0, id_1.generateId)(),
        batchId: batch.id,
        actionType: 'APPROVE_REWORK',
        previousStatus: batch.status,
        newStatus: 'REWORK',
        actor: params.approvedBy,
        timestamp: (0, id_1.getTimestamp)(),
        reason: params.reason
    };
    batch.history.push(historyEntry);
    batch.status = 'REWORK';
    batch.updatedAt = (0, id_1.getTimestamp)();
    (0, store_1.saveBatch)(batch);
    return {
        success: true,
        message: `返工已由 ${params.approvedBy} 批准`,
        data: batch
    };
}
function closeBatch(params) {
    const batch = (0, store_1.getBatch)(params.batchNumber);
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
    if (!(0, stateMachine_1.validateAction)('CLOSE_BATCH', batch.status)) {
        return {
            success: false,
            message: `批次状态 ${batch.status} 不允许关闭`,
            errors: [`状态校验失败: 当前状态 ${batch.status}`]
        };
    }
    const historyEntry = {
        id: (0, id_1.generateId)(),
        batchId: batch.id,
        actionType: 'CLOSE_BATCH',
        previousStatus: batch.status,
        newStatus: 'CLOSED',
        actor: params.closedBy,
        timestamp: (0, id_1.getTimestamp)(),
        reason: params.reason || '批次处理完成'
    };
    batch.history.push(historyEntry);
    batch.status = 'CLOSED';
    batch.closedAt = (0, id_1.getTimestamp)();
    batch.updatedAt = (0, id_1.getTimestamp)();
    (0, store_1.saveBatch)(batch);
    return {
        success: true,
        message: `批次已由 ${params.closedBy} 关闭`,
        data: batch
    };
}
function manualCorrection(params) {
    const batch = (0, store_1.getBatch)(params.batchNumber);
    if (!batch) {
        return {
            success: false,
            message: `批次 ${params.batchNumber} 不存在`,
            errors: [`批次不存在: ${params.batchNumber}`]
        };
    }
    const approvalValidation = (0, rules_1.validateModificationAfterApproval)(batch, params.correctedBy);
    const historyEntry = {
        id: (0, id_1.generateId)(),
        batchId: batch.id,
        actionType: 'MANUAL_CORRECTION',
        previousStatus: batch.status,
        newStatus: batch.status,
        actor: params.correctedBy,
        timestamp: (0, id_1.getTimestamp)(),
        reason: params.reason,
        differences: [{
                field: params.field,
                oldValue: params.oldValue,
                newValue: params.newValue
            }]
    };
    batch[params.field] = params.newValue;
    batch.history.push(historyEntry);
    batch.updatedAt = (0, id_1.getTimestamp)();
    (0, store_1.saveBatch)(batch);
    return {
        success: true,
        message: `人工修正已记录`,
        data: batch,
        warnings: approvalValidation.warnings
    };
}
//# sourceMappingURL=batchService.js.map