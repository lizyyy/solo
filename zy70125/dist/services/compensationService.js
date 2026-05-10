"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCompensationAction = createCompensationAction;
exports.attemptCompensation = attemptCompensation;
exports.listCompensationActions = listCompensationActions;
exports.retryAllPending = retryAllPending;
exports.getCompensationStatusLabel = getCompensationStatusLabel;
exports.getRelatedRecordTypeLabel = getRelatedRecordTypeLabel;
const uuid_1 = require("uuid");
const storage_1 = require("../storage");
function createCompensationAction(input) {
    const now = new Date().toISOString();
    const action = {
        id: (0, uuid_1.v4)(),
        relatedRecordId: input.relatedRecordId,
        relatedRecordType: input.relatedRecordType,
        actionType: input.actionType,
        description: input.description,
        parameters: input.parameters,
        attemptCount: 0,
        maxAttempts: input.maxAttempts || 5,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
    };
    (0, storage_1.updateDB)(d => ({
        ...d,
        compensationActions: [...d.compensationActions, action],
    }));
    return {
        success: true,
        message: `已创建补偿动作：${input.description}，最多可重试 ${action.maxAttempts} 次`,
        data: action,
    };
}
function attemptCompensation(actionId, handler) {
    const db = (0, storage_1.getDB)();
    const action = db.compensationActions.find(a => a.id === actionId);
    if (!action) {
        return {
            success: false,
            message: `未找到ID为「${actionId}」的补偿动作`,
        };
    }
    if (action.status === 'success') {
        return {
            success: false,
            message: `该补偿动作已成功执行，无需重复操作`,
        };
    }
    if (action.status === 'failed_permanent') {
        return {
            success: false,
            message: `该补偿动作已达到最大重试次数（${action.maxAttempts}次），已标记为永久失败。如需继续，请创建新的补偿动作。`,
            suggestions: [
                `您可以创建新的补偿动作来替代此失败动作，或者检查问题原因后手动处理`,
            ],
        };
    }
    const now = new Date().toISOString();
    const newAttemptCount = action.attemptCount + 1;
    (0, storage_1.updateDB)(d => ({
        ...d,
        compensationActions: d.compensationActions.map(a => a.id === actionId
            ? {
                ...a,
                attemptCount: newAttemptCount,
                lastAttemptAt: now,
                status: 'in_progress',
                updatedAt: now,
            }
            : a),
    }));
    let result;
    try {
        result = handler(action);
    }
    catch (error) {
        result = {
            success: false,
            message: `补偿动作执行时发生异常：${error instanceof Error ? error.message : String(error)}`,
        };
    }
    let finalStatus;
    let finalMessage = result.message;
    if (result.success) {
        finalStatus = 'success';
        finalMessage = `补偿动作「${action.description}」执行成功！${finalMessage}`;
    }
    else {
        if (newAttemptCount >= action.maxAttempts) {
            finalStatus = 'failed_permanent';
            finalMessage = `补偿动作「${action.description}」已尝试 ${newAttemptCount} 次，全部失败，已标记为永久失败。${finalMessage}`;
        }
        else {
            finalStatus = 'pending';
            finalMessage = `补偿动作「${action.description}」第 ${newAttemptCount}/${action.maxAttempts} 次尝试失败。${finalMessage} 可继续重试。`;
        }
    }
    (0, storage_1.updateDB)(d => ({
        ...d,
        compensationActions: d.compensationActions.map(a => a.id === actionId
            ? {
                ...a,
                status: finalStatus,
                lastError: result.success ? undefined : result.message,
                updatedAt: now,
            }
            : a),
    }));
    return {
        success: result.success,
        message: finalMessage,
        data: {
            actionId,
            attemptCount: newAttemptCount,
            remainingAttempts: action.maxAttempts - newAttemptCount,
            status: finalStatus,
        },
        suggestions: !result.success && newAttemptCount < action.maxAttempts
            ? [`还剩 ${action.maxAttempts - newAttemptCount} 次重试机会，请检查问题后再次执行补偿`]
            : undefined,
    };
}
function listCompensationActions(statusFilter, relatedRecordType) {
    const db = (0, storage_1.getDB)();
    let filtered = [...db.compensationActions];
    if (statusFilter) {
        filtered = filtered.filter(a => a.status === statusFilter);
    }
    if (relatedRecordType) {
        filtered = filtered.filter(a => a.relatedRecordType === relatedRecordType);
    }
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const pendingCount = filtered.filter(a => a.status === 'pending').length;
    const successCount = filtered.filter(a => a.status === 'success').length;
    const failedCount = filtered.filter(a => a.status === 'failed_permanent').length;
    return {
        success: true,
        message: `共查询到 ${filtered.length} 个补偿动作：待执行 ${pendingCount} 个，已成功 ${successCount} 个，永久失败 ${failedCount} 个`,
        data: filtered,
    };
}
function retryAllPending() {
    const db = (0, storage_1.getDB)();
    const pendingActions = db.compensationActions.filter(a => a.status === 'pending');
    if (pendingActions.length === 0) {
        return {
            success: true,
            message: '当前没有待执行的补偿动作',
            data: { total: 0, successCount: 0, failedCount: 0, results: [] },
        };
    }
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    for (const action of pendingActions) {
        const result = attemptCompensation(action.id, a => {
            return {
                success: true,
                message: `补偿动作「${a.actionType}」已标记为执行，请根据 actionType 手动执行具体补偿逻辑，或扩展补偿处理器`,
            };
        });
        results.push({
            actionId: action.id,
            success: result.success,
            message: result.message,
        });
        if (result.success) {
            successCount++;
        }
        else {
            failedCount++;
        }
    }
    return {
        success: true,
        message: `批量重试完成：共 ${pendingActions.length} 个，成功 ${successCount} 个，失败 ${failedCount} 个`,
        data: {
            total: pendingActions.length,
            successCount,
            failedCount,
            results,
        },
    };
}
function getCompensationStatusLabel(status) {
    const labels = {
        pending: '待执行',
        in_progress: '执行中',
        success: '成功',
        failed_permanent: '永久失败',
    };
    return labels[status] || status;
}
function getRelatedRecordTypeLabel(type) {
    const labels = {
        borrow: '借出记录',
        damage: '损坏记录',
        repair: '维修记录',
        tour: '巡演清单',
    };
    return labels[type] || type;
}
