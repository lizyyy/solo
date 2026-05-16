"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelRequestStore = exports.InMemoryCancelRequestStore = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
class InMemoryCancelRequestStore {
    constructor() {
        this.requests = new Map();
    }
    async create(request) {
        const now = new Date();
        const cancelRequest = {
            requestId: (0, uuid_1.v4)(),
            jobId: request.jobId,
            jobName: request.jobName,
            status: types_1.CancelRequestStatus.PENDING,
            tasks: request.tasks.map(t => ({
                ...t,
                executionStatus: t.executionStatus
            })),
            reasons: [{
                    code: request.reason.code,
                    message: request.reason.message,
                    operator: request.reason.operator,
                    operatedAt: now,
                    evidence: request.reason.evidence
                }],
            retainResultPolicy: request.retainResultPolicy,
            reports: [],
            failurePaths: [],
            createdAt: now,
            updatedAt: now
        };
        this.requests.set(cancelRequest.requestId, cancelRequest);
        return cancelRequest;
    }
    async getById(requestId) {
        return this.requests.get(requestId);
    }
    async query(params) {
        let result = Array.from(this.requests.values());
        if (params.jobId) {
            result = result.filter(r => r.jobId === params.jobId);
        }
        if (params.status) {
            result = result.filter(r => r.status === params.status);
        }
        if (params.operator) {
            result = result.filter(r => r.reasons.some(reason => reason.operator === params.operator));
        }
        if (params.startTime) {
            const startTime = params.startTime;
            result = result.filter(r => r.createdAt >= startTime);
        }
        if (params.endTime) {
            const endTime = params.endTime;
            result = result.filter(r => r.createdAt <= endTime);
        }
        const total = result.length;
        const page = params.page || 1;
        const pageSize = params.pageSize || 20;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        result = result.slice(startIndex, endIndex);
        return {
            data: result,
            total,
            page,
            pageSize
        };
    }
    async updateStatus(requestId, status, reason) {
        const request = this.requests.get(requestId);
        if (!request) {
            return undefined;
        }
        const now = new Date();
        request.status = status;
        request.updatedAt = now;
        if (status === types_1.CancelRequestStatus.CONFIRMED && !request.confirmedAt) {
            request.confirmedAt = now;
        }
        if (status === types_1.CancelRequestStatus.CANCELED ||
            status === types_1.CancelRequestStatus.COMPENSATED) {
            request.completedAt = now;
        }
        if (reason) {
            request.reasons.push(reason);
        }
        this.requests.set(requestId, request);
        return request;
    }
    async updateTask(requestId, taskId, updates) {
        const request = this.requests.get(requestId);
        if (!request) {
            return undefined;
        }
        const taskIndex = request.tasks.findIndex(t => t.taskId === taskId);
        if (taskIndex === -1) {
            return undefined;
        }
        request.tasks[taskIndex] = {
            ...request.tasks[taskIndex],
            ...updates
        };
        request.updatedAt = new Date();
        this.requests.set(requestId, request);
        return request;
    }
    async addReport(requestId, report) {
        const request = this.requests.get(requestId);
        if (!request) {
            return undefined;
        }
        request.reports.push(report);
        request.updatedAt = new Date();
        this.requests.set(requestId, request);
        return request;
    }
    async addFailurePath(requestId, failurePath) {
        const request = this.requests.get(requestId);
        if (!request) {
            return undefined;
        }
        request.failurePaths.push(failurePath);
        request.updatedAt = new Date();
        this.requests.set(requestId, request);
        return request;
    }
    async addReason(requestId, reason) {
        const request = this.requests.get(requestId);
        if (!request) {
            return undefined;
        }
        request.reasons.push(reason);
        request.updatedAt = new Date();
        this.requests.set(requestId, request);
        return request;
    }
    async delete(requestId) {
        return this.requests.delete(requestId);
    }
}
exports.InMemoryCancelRequestStore = InMemoryCancelRequestStore;
exports.cancelRequestStore = new InMemoryCancelRequestStore();
//# sourceMappingURL=CancelRequestStore.js.map