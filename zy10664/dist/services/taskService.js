"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskService = exports.TaskService = void 0;
const types_1 = require("../types");
const store_1 = require("../store");
const validator_1 = require("../utils/validator");
const FUSE_THRESHOLD = 3;
class TaskService {
    createTask(request) {
        if (!validator_1.validator.validateCreateTask(request)) {
            return { success: false, errors: validator_1.validator.getErrors() };
        }
        const existing = store_1.store.getTaskByCode(request.taskCode);
        if (existing) {
            return {
                success: false,
                errors: [{ field: 'taskCode', message: '任务编码已存在', rule: 'UNIQUE' }]
            };
        }
        const task = store_1.store.createTask({
            taskName: request.taskName,
            taskCode: request.taskCode,
            schedulerName: request.schedulerName
        });
        store_1.store.addAuditHistory(task.id, {
            action: types_1.AuditAction.CREATE,
            operator: 'system'
        });
        return { success: true, data: task };
    }
    getTaskDetail(id) {
        const task = store_1.store.getTask(id);
        if (!task) {
            return { success: false, message: '任务不存在' };
        }
        const recoveryConditions = store_1.store.getRecoveryConditions(id);
        const failureRecords = store_1.store.getFailureRecords(id);
        const auditHistories = store_1.store.getAuditHistories(id);
        return {
            success: true,
            data: {
                ...task,
                recoveryConditions,
                failureRecords,
                auditHistories
            }
        };
    }
    updateTask(id, request) {
        const task = store_1.store.getTask(id);
        if (!task) {
            return { success: false, message: '任务不存在' };
        }
        if (!validator_1.validator.validateUpdateTask(request)) {
            return { success: false, errors: validator_1.validator.getErrors() };
        }
        const updated = store_1.store.updateTask(id, request);
        if (updated) {
            store_1.store.addAuditHistory(id, {
                action: types_1.AuditAction.UPDATE,
                operator: 'system',
                remark: '更新任务信息'
            });
        }
        return { success: true, data: updated };
    }
    listTasks(query) {
        const result = store_1.store.listTasks(query);
        return {
            success: true,
            data: {
                total: result.total,
                list: result.data
            }
        };
    }
    recordFailure(id, request) {
        const task = store_1.store.getTask(id);
        if (!task) {
            return { success: false, message: '任务不存在' };
        }
        if (!validator_1.validator.validateRecordFailure(request)) {
            return { success: false, errors: validator_1.validator.getErrors() };
        }
        store_1.store.addFailureRecord(id, {
            failureTime: new Date(),
            errorMessage: request.errorMessage,
            errorStack: request.errorStack,
            retryCount: request.retryCount,
            isInQueue: true,
            isProcessed: false
        });
        const newFailureCount = task.failureCount + 1;
        const hasQueuedRetry = true;
        if (newFailureCount >= FUSE_THRESHOLD && task.status === types_1.TaskStatus.RUNNING) {
            const updated = store_1.store.updateTask(id, {
                failureCount: newFailureCount,
                status: types_1.TaskStatus.FUSED,
                fuseReason: `连续失败${newFailureCount}次触发熔断`,
                fusedAt: new Date(),
                hasQueuedRetry
            });
            store_1.store.addAuditHistory(id, {
                action: types_1.AuditAction.FUSE,
                operator: 'system',
                oldStatus: types_1.TaskStatus.RUNNING,
                newStatus: types_1.TaskStatus.FUSED,
                remark: `连续失败${newFailureCount}次触发熔断`
            });
            return { success: true, data: updated };
        }
        const updated = store_1.store.updateTask(id, {
            failureCount: newFailureCount,
            hasQueuedRetry
        });
        return { success: true, data: updated };
    }
    applyRecovery(id, request) {
        const task = store_1.store.getTask(id);
        if (!task) {
            return { success: false, message: '任务不存在' };
        }
        if (task.status !== types_1.TaskStatus.FUSED) {
            return {
                success: false,
                errors: [{ field: 'status', message: '只有熔断状态的任务才能申请恢复', rule: 'STATUS' }]
            };
        }
        if (!validator_1.validator.validateApplyRecovery(request)) {
            return { success: false, errors: validator_1.validator.getErrors() };
        }
        for (const condition of request.recoveryConditions) {
            store_1.store.addRecoveryCondition(id, {
                type: condition.type,
                description: condition.description
            });
        }
        const updated = store_1.store.updateTask(id, {
            status: types_1.TaskStatus.RECOVERY_APPLY,
            recoveryApplyAt: new Date(),
            recoveryApplicant: request.applicant,
            recoveryRemark: request.recoveryRemark
        });
        store_1.store.addAuditHistory(id, {
            action: types_1.AuditAction.APPLY_RECOVERY,
            operator: request.applicant,
            oldStatus: types_1.TaskStatus.FUSED,
            newStatus: types_1.TaskStatus.RECOVERY_APPLY,
            remark: request.recoveryRemark
        });
        return { success: true, data: updated };
    }
    auditRecovery(id, request) {
        const task = store_1.store.getTask(id);
        if (!task) {
            return { success: false, message: '任务不存在' };
        }
        if (task.status !== types_1.TaskStatus.RECOVERY_APPLY) {
            return {
                success: false,
                errors: [{ field: 'status', message: '只有申请恢复状态的任务才能审核', rule: 'STATUS' }]
            };
        }
        if (!validator_1.validator.validateAuditRecovery(request)) {
            return { success: false, errors: validator_1.validator.getErrors() };
        }
        if (request.approved) {
            const conditions = store_1.store.getRecoveryConditions(id);
            const allMet = conditions.every(c => c.isMet);
            if (!allMet && conditions.length > 0) {
                return {
                    success: false,
                    errors: [{ field: 'recoveryConditions', message: '恢复条件未全部满足', rule: 'CONDITIONS' }]
                };
            }
            const updated = store_1.store.updateTask(id, {
                status: types_1.TaskStatus.RECOVERED,
                recoveredAt: new Date(),
                recoveryAuditor: request.auditor,
                failureCount: 0
            });
            store_1.store.addAuditHistory(id, {
                action: types_1.AuditAction.APPROVE_RECOVERY,
                operator: request.auditor,
                oldStatus: types_1.TaskStatus.RECOVERY_APPLY,
                newStatus: types_1.TaskStatus.RECOVERED,
                remark: request.auditRemark
            });
            return { success: true, data: updated };
        }
        else {
            const updated = store_1.store.updateTask(id, {
                status: types_1.TaskStatus.FUSED
            });
            store_1.store.addAuditHistory(id, {
                action: types_1.AuditAction.REJECT_RECOVERY,
                operator: request.auditor,
                oldStatus: types_1.TaskStatus.RECOVERY_APPLY,
                newStatus: types_1.TaskStatus.FUSED,
                remark: request.auditRemark
            });
            return { success: true, data: updated };
        }
    }
    withdraw(id, request) {
        const task = store_1.store.getTask(id);
        if (!task) {
            return { success: false, message: '任务不存在' };
        }
        if (task.status !== types_1.TaskStatus.RECOVERY_APPLY) {
            return {
                success: false,
                errors: [{ field: 'status', message: '只有申请恢复状态的任务才能撤回', rule: 'STATUS' }]
            };
        }
        if (!validator_1.validator.validateWithdraw(request)) {
            return { success: false, errors: validator_1.validator.getErrors() };
        }
        const updated = store_1.store.updateTask(id, {
            status: types_1.TaskStatus.FUSED
        });
        store_1.store.addAuditHistory(id, {
            action: types_1.AuditAction.WITHDRAW,
            operator: request.operator,
            oldStatus: types_1.TaskStatus.RECOVERY_APPLY,
            newStatus: types_1.TaskStatus.FUSED,
            remark: request.reason
        });
        return { success: true, data: updated };
    }
    addManualRemark(id, request) {
        const task = store_1.store.getTask(id);
        if (!task) {
            return { success: false, message: '任务不存在' };
        }
        if (!validator_1.validator.validateManualRemark(request)) {
            return { success: false, errors: validator_1.validator.getErrors() };
        }
        const failureRecords = store_1.store.getFailureRecords(id);
        const queuedRecords = failureRecords.filter(r => r.isInQueue && !r.isProcessed);
        for (const record of queuedRecords) {
            store_1.store.updateFailureRecord(record.id, { isProcessed: true });
        }
        const updated = store_1.store.updateTask(id, {
            manualRemark: request.remark,
            hasQueuedRetry: false
        });
        store_1.store.addAuditHistory(id, {
            action: types_1.AuditAction.MANUAL_REMARK,
            operator: request.operator,
            remark: `${request.remark} (已处理${queuedRecords.length}条队列中的重试记录)`
        });
        return { success: true, data: updated };
    }
    meetRecoveryCondition(taskId, conditionId, operator) {
        const condition = store_1.store.updateRecoveryCondition(conditionId, {
            isMet: true,
            metAt: new Date(),
            metBy: operator
        });
        if (!condition) {
            return { success: false, message: '恢复条件不存在' };
        }
        return { success: true, data: condition };
    }
    exportTasks() {
        return {
            success: true,
            data: store_1.store.getAllTasks()
        };
    }
    importTasks(data) {
        const result = {
            success: 0,
            failed: 0,
            errors: [],
            conflicts: []
        };
        data.forEach((row, index) => {
            const rowNum = index + 1;
            if (!validator_1.validator.validateImportRow(row, rowNum)) {
                result.failed++;
                result.errors.push({
                    row: rowNum,
                    data: row,
                    errors: validator_1.validator.getErrors()
                });
                return;
            }
            const existing = store_1.store.getTaskByCode(row.taskCode);
            if (existing) {
                result.conflicts.push({
                    row: rowNum,
                    data: row,
                    existingTaskId: existing.id,
                    message: `任务编码 ${row.taskCode} 已存在`
                });
                return;
            }
            const task = store_1.store.createTask({
                taskName: row.taskName,
                taskCode: row.taskCode,
                schedulerName: row.schedulerName
            });
            if (row.failureCount) {
                store_1.store.updateTask(task.id, { failureCount: parseInt(row.failureCount, 10) });
            }
            if (row.status && Object.values(types_1.TaskStatus).includes(row.status)) {
                store_1.store.updateTask(task.id, { status: row.status });
            }
            store_1.store.addAuditHistory(task.id, {
                action: types_1.AuditAction.CREATE,
                operator: 'import',
                remark: `从第${rowNum}行导入`
            });
            result.success++;
        });
        return { success: true, data: result };
    }
}
exports.TaskService = TaskService;
exports.taskService = new TaskService();
