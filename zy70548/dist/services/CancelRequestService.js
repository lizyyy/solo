"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelRequestService = exports.CancelRequestService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const CancelRequestStore_1 = require("../store/CancelRequestStore");
class CancelRequestService {
    constructor() {
        this.store = CancelRequestStore_1.cancelRequestStore;
    }
    async createCancelRequest(request) {
        const cancelRequest = await this.store.create(request);
        await this.recordFailurePath(cancelRequest.requestId, request, '用户提交撤销请求，初始状态为待处理', `撤销请求已创建，共${request.tasks.length}个任务待处理`);
        return cancelRequest;
    }
    async getCancelRequest(requestId) {
        return this.store.getById(requestId);
    }
    async queryCancelRequests(params) {
        return this.store.query(params);
    }
    async updateStatus(requestId, updateRequest) {
        const request = await this.store.getById(requestId);
        if (!request) {
            return undefined;
        }
        const validation = this.validateStatusTransition(request.status, updateRequest.status);
        if (!validation.valid) {
            await this.recordFailurePath(requestId, { currentStatus: request.status, targetStatus: updateRequest.status }, validation.reason || '状态转换验证失败', '状态转换被拒绝');
            throw new Error(validation.reason || 'Invalid status transition');
        }
        const reason = updateRequest.reason
            ? {
                code: 'STATUS_UPDATE',
                message: updateRequest.reason,
                operator: updateRequest.operator,
                operatedAt: new Date()
            }
            : undefined;
        return this.store.updateStatus(requestId, updateRequest.status, reason);
    }
    async confirmCancelRequest(requestId, operator) {
        const request = await this.store.getById(requestId);
        if (!request) {
            return undefined;
        }
        if (request.status !== types_1.CancelRequestStatus.PENDING) {
            throw new Error('Only pending requests can be confirmed');
        }
        return this.store.updateStatus(requestId, types_1.CancelRequestStatus.CONFIRMED, {
            code: 'CONFIRMED',
            message: '撤销请求已确认，开始执行撤销流程',
            operator,
            operatedAt: new Date()
        });
    }
    async processCancelRequest(requestId) {
        const request = await this.store.getById(requestId);
        if (!request) {
            return undefined;
        }
        if (request.status !== types_1.CancelRequestStatus.CONFIRMED) {
            throw new Error('Only confirmed requests can be processed');
        }
        await this.store.updateStatus(requestId, types_1.CancelRequestStatus.INTERCEPTED, {
            code: 'INTERCEPTING',
            message: '开始拦截未执行的任务',
            operator: 'SYSTEM',
            operatedAt: new Date()
        });
        const report = await this.generateCancelReport(request);
        await this.store.addReport(requestId, report);
        const finalStatus = report.interceptedTasks > 0 || report.canceledTasks > 0
            ? types_1.CancelRequestStatus.CANCELED
            : types_1.CancelRequestStatus.COMPENSATED;
        return this.store.updateStatus(requestId, finalStatus, {
            code: 'COMPLETED',
            message: `撤销处理完成，已拦截${report.interceptedTasks}个任务，撤销${report.canceledTasks}个任务，保护${report.protectedTasks}个已执行任务`,
            operator: 'SYSTEM',
            operatedAt: new Date()
        });
    }
    async cancelPendingTasks(requestId) {
        const request = await this.store.getById(requestId);
        if (!request) {
            throw new Error('Request not found');
        }
        let intercepted = 0;
        let canceled = 0;
        let protectedTasks = 0;
        for (const task of request.tasks) {
            if (task.executionStatus === types_1.TaskExecutionStatus.PENDING) {
                await this.store.updateTask(requestId, task.taskId, {
                    executionStatus: types_1.TaskExecutionStatus.CANCELED
                });
                intercepted++;
            }
            else if (task.executionStatus === types_1.TaskExecutionStatus.RUNNING) {
                await this.store.updateTask(requestId, task.taskId, {
                    executionStatus: types_1.TaskExecutionStatus.CANCELED
                });
                canceled++;
            }
            else {
                protectedTasks++;
            }
        }
        return { intercepted, canceled, protected: protectedTasks };
    }
    async manualCorrection(requestId, correction) {
        const request = await this.store.getById(requestId);
        if (!request) {
            return undefined;
        }
        const task = request.tasks.find(t => t.taskId === correction.taskId);
        if (!task) {
            throw new Error('Task not found');
        }
        const originalStatus = task.executionStatus;
        await this.store.updateTask(requestId, correction.taskId, {
            executionStatus: correction.newStatus
        });
        await this.store.addReason(requestId, {
            code: 'MANUAL_CORRECTION',
            message: `人工修正: ${correction.reason}，状态从 ${originalStatus} 改为 ${correction.newStatus}`,
            operator: correction.operator,
            operatedAt: new Date()
        });
        await this.recordFailurePath(requestId, { taskId: correction.taskId, originalStatus, newStatus: correction.newStatus }, `人工修正操作: ${correction.reason}`, `任务状态已由操作员${correction.operator}人工调整`);
        return this.store.getById(requestId);
    }
    async recordFailurePath(requestId, originalInput, processingBasis, conclusion) {
        const failurePath = {
            originalInput,
            processingBasis,
            conclusion,
            occurredAt: new Date()
        };
        await this.store.addFailurePath(requestId, failurePath);
    }
    async generateCancelReport(request) {
        const originalTaskStatuses = new Map();
        request.tasks.forEach(task => {
            originalTaskStatuses.set(task.taskId, task.executionStatus);
        });
        const result = await this.cancelPendingTasks(request.requestId);
        const details = request.tasks.map(task => {
            const originalStatus = originalTaskStatuses.get(task.taskId);
            const finalStatus = originalStatus === types_1.TaskExecutionStatus.PENDING ||
                originalStatus === types_1.TaskExecutionStatus.RUNNING
                ? types_1.TaskExecutionStatus.CANCELED
                : originalStatus;
            return {
                taskId: task.taskId,
                taskName: task.taskName,
                originalStatus,
                finalStatus,
                action: this.getTaskAction(originalStatus),
                reason: this.getTaskActionReason(originalStatus)
            };
        });
        const summary = this.generateSummary(request, result);
        return {
            reportId: (0, uuid_1.v4)(),
            generatedAt: new Date(),
            totalTasks: request.tasks.length,
            interceptedTasks: result.intercepted,
            canceledTasks: result.canceled,
            protectedTasks: result.protected,
            failedTasks: Array.from(originalTaskStatuses.values()).filter(s => s === types_1.TaskExecutionStatus.FAILED).length,
            summary,
            details,
            failurePaths: request.failurePaths
        };
    }
    getTaskAction(status) {
        switch (status) {
            case types_1.TaskExecutionStatus.PENDING:
                return 'INTERCEPTED';
            case types_1.TaskExecutionStatus.RUNNING:
                return 'CANCELED';
            case types_1.TaskExecutionStatus.COMPLETED:
                return 'PROTECTED';
            case types_1.TaskExecutionStatus.FAILED:
                return 'PROTECTED';
            default:
                return 'NO_ACTION';
        }
    }
    getTaskActionReason(status) {
        switch (status) {
            case types_1.TaskExecutionStatus.PENDING:
                return '未执行任务已拦截';
            case types_1.TaskExecutionStatus.RUNNING:
                return '执行中任务已撤销';
            case types_1.TaskExecutionStatus.COMPLETED:
                return '已完成任务受保护，结果保留';
            case types_1.TaskExecutionStatus.FAILED:
                return '失败任务状态保留';
            default:
                return '无操作';
        }
    }
    generateSummary(request, result) {
        const parts = [];
        parts.push(`作业【${request.jobName}】撤销处理总结:`);
        parts.push(`- 总任务数: ${request.tasks.length}`);
        parts.push(`- 已拦截(未执行): ${result.intercepted}`);
        parts.push(`- 已撤销(执行中): ${result.canceled}`);
        parts.push(`- 已保护(已完成/失败): ${result.protected}`);
        parts.push(`- 结果保留策略: ${request.retainResultPolicy}`);
        return parts.join(' ');
    }
    validateStatusTransition(currentStatus, targetStatus) {
        const validTransitions = {
            [types_1.CancelRequestStatus.PENDING]: [types_1.CancelRequestStatus.CONFIRMED],
            [types_1.CancelRequestStatus.CONFIRMED]: [types_1.CancelRequestStatus.INTERCEPTED],
            [types_1.CancelRequestStatus.INTERCEPTED]: [
                types_1.CancelRequestStatus.CANCELED,
                types_1.CancelRequestStatus.COMPENSATED
            ],
            [types_1.CancelRequestStatus.CANCELED]: [],
            [types_1.CancelRequestStatus.COMPENSATED]: []
        };
        const allowed = validTransitions[currentStatus];
        if (!allowed.includes(targetStatus)) {
            return {
                valid: false,
                reason: `状态 ${currentStatus} 不允许转换为 ${targetStatus}，允许的目标状态: ${allowed.join(', ') || '无'}`
            };
        }
        return { valid: true };
    }
    async addOperatorNote(requestId, operator, note) {
        return this.store.addReason(requestId, {
            code: 'OPERATOR_NOTE',
            message: note,
            operator,
            operatedAt: new Date()
        });
    }
}
exports.CancelRequestService = CancelRequestService;
exports.cancelRequestService = new CancelRequestService();
//# sourceMappingURL=CancelRequestService.js.map