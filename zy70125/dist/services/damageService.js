"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportDamage = reportDamage;
exports.resolveDamage = resolveDamage;
exports.startRepair = startRepair;
exports.completeRepair = completeRepair;
exports.listDamageRecords = listDamageRecords;
exports.listRepairRecords = listRepairRecords;
exports.getDamageSeverityLabel = getDamageSeverityLabel;
const uuid_1 = require("uuid");
const storage_1 = require("../storage");
const caseService_1 = require("./caseService");
const cityService_1 = require("./cityService");
const compensationService_1 = require("./compensationService");
function reportDamage(input) {
    const caseResult = (0, caseService_1.getCaseByIdentifier)(input.caseIdentifier);
    if (!caseResult.success) {
        return { success: false, message: caseResult.message };
    }
    const caseObj = caseResult.data;
    const cityResult = (0, cityService_1.getCityByIdentifier)(input.cityIdentifier);
    if (!cityResult.success) {
        return { success: false, message: cityResult.message };
    }
    let itemId;
    if (input.itemName) {
        const item = caseObj.items.find(i => i.name === input.itemName);
        if (!item) {
            return {
                success: false,
                message: `设备箱「${caseObj.caseNumber}」中未找到设备「${input.itemName}」`,
            };
        }
        itemId = item.id;
    }
    const now = new Date().toISOString();
    const record = {
        id: (0, uuid_1.v4)(),
        caseId: caseObj.id,
        itemId,
        cityId: cityResult.data.id,
        reportedBy: input.reportedBy,
        severity: input.severity,
        description: input.description,
        damageTime: input.damageTime || now,
        estimatedCost: input.estimatedCost,
        isResolved: false,
        createdAt: now,
    };
    (0, storage_1.updateDB)(d => ({
        ...d,
        damageRecords: [...d.damageRecords, record],
    }));
    const severityLabels = {
        minor: '轻微',
        medium: '中等',
        major: '严重',
        critical: '极其严重',
    };
    const message = `已在「${cityResult.data.name}」报告设备箱「${caseObj.caseNumber}」${input.itemName ? `的设备「${input.itemName}」` : ''}损坏，严重程度：${severityLabels[input.severity]}。`;
    const compensationResult = (0, compensationService_1.createCompensationAction)({
        relatedRecordId: record.id,
        relatedRecordType: 'damage',
        actionType: 'review_responsibility',
        description: `审查设备箱「${caseObj.caseNumber}」损坏责任，严重程度：${severityLabels[input.severity]}`,
        parameters: { damageId: record.id },
    });
    return {
        success: true,
        message: message + (compensationResult.success ? ' 已自动创建责任审查任务。' : ''),
        data: record,
        suggestions: ['请尽快启动维修流程，或与相关责任人确认责任归属'],
    };
}
function resolveDamage(input) {
    const db = (0, storage_1.getDB)();
    const record = db.damageRecords.find(d => d.id === input.damageId);
    if (!record) {
        return {
            success: false,
            message: `未找到ID为「${input.damageId}」的损坏记录`,
        };
    }
    if (record.isResolved) {
        return {
            success: false,
            message: `该损坏记录已于「${record.resolvedAt}」由「${record.resolvedBy}」解决，无需重复操作`,
        };
    }
    const now = new Date().toISOString();
    (0, storage_1.updateDB)(d => ({
        ...d,
        damageRecords: d.damageRecords.map(r => r.id === input.damageId
            ? {
                ...r,
                isResolved: true,
                resolvedAt: now,
                resolvedBy: input.resolvedBy,
                resolution: input.resolution,
                responsibility: input.responsibility || r.responsibility,
            }
            : r),
    }));
    const updatedRecord = {
        ...record,
        isResolved: true,
        resolvedAt: now,
        resolvedBy: input.resolvedBy,
        resolution: input.resolution,
        responsibility: input.responsibility || record.responsibility,
    };
    return {
        success: true,
        message: `损坏记录已解决。处理人：${input.resolvedBy}，处理方案：${input.resolution}${input.responsibility ? `，责任归属：${input.responsibility}` : ''}`,
        data: updatedRecord,
    };
}
function startRepair(input) {
    const caseResult = (0, caseService_1.getCaseByIdentifier)(input.caseIdentifier);
    if (!caseResult.success) {
        return { success: false, message: caseResult.message };
    }
    const caseObj = caseResult.data;
    if (caseObj.status === 'under_repair') {
        return {
            success: false,
            message: `设备箱「${caseObj.caseNumber}」当前已在维修中，无法重复启动维修`,
        };
    }
    if (caseObj.status !== 'in_stock' && caseObj.status !== 'damaged') {
        return {
            success: false,
            message: `设备箱「${caseObj.caseNumber}」当前状态为「${(0, caseService_1.getCaseStatusLabel)(caseObj.status)}」，只有「在库」或「已损坏」状态才能启动维修`,
        };
    }
    let damageRecordId;
    if (input.damageId) {
        const db = (0, storage_1.getDB)();
        const damageRecord = db.damageRecords.find(d => d.id === input.damageId);
        if (!damageRecord) {
            return {
                success: false,
                message: `未找到ID为「${input.damageId}」的损坏记录`,
            };
        }
        damageRecordId = damageRecord.id;
    }
    let itemId;
    if (input.itemName) {
        const item = caseObj.items.find(i => i.name === input.itemName);
        if (!item) {
            return {
                success: false,
                message: `设备箱「${caseObj.caseNumber}」中未找到设备「${input.itemName}」`,
            };
        }
        itemId = item.id;
    }
    const now = new Date().toISOString();
    const record = {
        id: (0, uuid_1.v4)(),
        damageRecordId: damageRecordId || '',
        caseId: caseObj.id,
        itemId,
        startedBy: input.startedBy,
        startTime: now,
        status: 'in_progress',
        description: input.description,
        createdAt: now,
        updatedAt: now,
    };
    (0, storage_1.updateDB)(d => ({
        ...d,
        repairRecords: [...d.repairRecords, record],
        equipmentCases: d.equipmentCases.map(c => c.id === caseObj.id
            ? {
                ...c,
                status: 'under_repair',
                updatedAt: now,
            }
            : c),
    }));
    return {
        success: true,
        message: `设备箱「${caseObj.caseNumber}」维修已启动，由「${input.startedBy}」负责。维修期间该设备箱无法借出或调拨。`,
        data: record,
    };
}
function completeRepair(input) {
    const db = (0, storage_1.getDB)();
    const record = db.repairRecords.find(r => r.id === input.repairId);
    if (!record) {
        return {
            success: false,
            message: `未找到ID为「${input.repairId}」的维修记录`,
        };
    }
    if (record.status === 'completed') {
        return {
            success: false,
            message: `该维修记录已于「${record.endTime}」完成`,
        };
    }
    const now = new Date().toISOString();
    (0, storage_1.updateDB)(d => ({
        ...d,
        repairRecords: d.repairRecords.map(r => r.id === input.repairId
            ? {
                ...r,
                status: 'completed',
                endTime: now,
                cost: input.cost,
                description: input.completionNote
                    ? `${r.description} | 完成备注：${input.completionNote}`
                    : r.description,
                updatedAt: now,
            }
            : r),
        equipmentCases: d.equipmentCases.map(c => c.id === record.caseId
            ? {
                ...c,
                status: 'in_stock',
                updatedAt: now,
            }
            : c),
    }));
    const caseObj = db.equipmentCases.find(c => c.id === record.caseId);
    return {
        success: true,
        message: `设备箱「${caseObj?.caseNumber || record.caseId}」维修已完成${input.cost ? `，维修费用 ¥${input.cost.toFixed(2)}` : ''}。设备箱已恢复「在库」状态，可正常使用。`,
        data: {
            ...record,
            status: 'completed',
            endTime: now,
            cost: input.cost,
            updatedAt: now,
        },
    };
}
function listDamageRecords(caseIdentifier, unresolvedOnly) {
    const db = (0, storage_1.getDB)();
    let filtered = [...db.damageRecords];
    if (caseIdentifier) {
        const caseResult = (0, caseService_1.getCaseByIdentifier)(caseIdentifier);
        if (!caseResult.success) {
            return {
                success: false,
                message: caseResult.message,
                data: [],
            };
        }
        filtered = filtered.filter(d => d.caseId === caseResult.data.id);
    }
    if (unresolvedOnly) {
        filtered = filtered.filter(d => !d.isResolved);
    }
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const unresolvedCount = filtered.filter(d => !d.isResolved).length;
    return {
        success: true,
        message: `共查询到 ${filtered.length} 条损坏记录，其中 ${unresolvedCount} 条未解决`,
        data: filtered,
    };
}
function listRepairRecords(caseIdentifier, statusFilter) {
    const db = (0, storage_1.getDB)();
    let filtered = [...db.repairRecords];
    if (caseIdentifier) {
        const caseResult = (0, caseService_1.getCaseByIdentifier)(caseIdentifier);
        if (!caseResult.success) {
            return {
                success: false,
                message: caseResult.message,
                data: [],
            };
        }
        filtered = filtered.filter(r => r.caseId === caseResult.data.id);
    }
    if (statusFilter) {
        filtered = filtered.filter(r => r.status === statusFilter);
    }
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const inProgressCount = filtered.filter(r => r.status === 'in_progress').length;
    return {
        success: true,
        message: `共查询到 ${filtered.length} 条维修记录，其中 ${inProgressCount} 条进行中`,
        data: filtered,
    };
}
function getDamageSeverityLabel(severity) {
    const labels = {
        minor: '轻微',
        medium: '中等',
        major: '严重',
        critical: '极其严重',
    };
    return labels[severity] || severity;
}
