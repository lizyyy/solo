"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskQueue = exports.DEFAULT_QUEUE_CONFIG = void 0;
exports.calculateBackoffDelay = calculateBackoffDelay;
exports.shouldRetry = shouldRetry;
const uuid_1 = require("uuid");
exports.DEFAULT_QUEUE_CONFIG = {
    maxConcurrent: 5,
    retryDelayMs: 1000,
    maxRetryDelayMs: 30000,
    backoffMultiplier: 2
};
class TaskQueue {
    constructor(config = {}) {
        this.pendingTasks = new Map();
        this.runningTasks = new Set();
        this.handlers = new Map();
        this.taskResults = new Map();
        this.config = { ...exports.DEFAULT_QUEUE_CONFIG, ...config };
    }
    registerHandler(handler) {
        this.handlers.set(handler.type, handler);
    }
    createTask(type, batchId, payload, options = {}) {
        const task = {
            id: (0, uuid_1.v4)(),
            type,
            batchId,
            enrollmentId: options.enrollmentId,
            status: 'pending',
            priority: options.priority || 100,
            payload,
            attemptCount: 0,
            maxAttempts: options.maxAttempts || 3,
            createdAt: new Date()
        };
        this.pendingTasks.set(task.id, task);
        this.scheduleExecution();
        return task;
    }
    getTaskStatus(taskId) {
        const pending = this.pendingTasks.get(taskId);
        if (pending)
            return pending;
        if (this.runningTasks.has(taskId)) {
            return { id: taskId, type: 'deviation_calculation', batchId: '', status: 'running', priority: 0, payload: {}, attemptCount: 0, maxAttempts: 0, createdAt: new Date() };
        }
        return undefined;
    }
    getTaskResult(taskId) {
        return this.taskResults.get(taskId);
    }
    scheduleExecution() {
        const availableSlots = this.config.maxConcurrent - this.runningTasks.size;
        if (availableSlots <= 0)
            return;
        const sortedTasks = Array.from(this.pendingTasks.values())
            .filter(t => t.status === 'pending')
            .sort((a, b) => b.priority - a.priority);
        for (let i = 0; i < Math.min(availableSlots, sortedTasks.length); i++) {
            this.executeTask(sortedTasks[i]);
        }
    }
    async executeTask(task) {
        const handler = this.handlers.get(task.type);
        if (!handler) {
            this.handleTaskFailure(task, `未找到类型为 ${task.type} 的处理器`);
            return;
        }
        this.runningTasks.add(task.id);
        this.pendingTasks.delete(task.id);
        const updatedTask = {
            ...task,
            status: 'running',
            attemptCount: task.attemptCount + 1,
            runAt: new Date()
        };
        try {
            const result = await handler.execute({
                task: updatedTask,
                progress: () => { },
                shouldCancel: () => false
            });
            if (result.success) {
                this.handleTaskSuccess(task, result.result);
            }
            else {
                this.handleTaskFailure(task, result.error || '任务执行失败');
            }
        }
        catch (error) {
            this.handleTaskFailure(task, error instanceof Error ? error.message : '未知错误');
        }
    }
    handleTaskSuccess(task, result) {
        this.runningTasks.delete(task.id);
        this.taskResults.set(task.id, {
            success: true,
            result,
            completedAt: new Date()
        });
        this.scheduleExecution();
    }
    handleTaskFailure(task, error) {
        this.runningTasks.delete(task.id);
        if (task.attemptCount < task.maxAttempts) {
            const updatedTask = {
                ...task,
                status: 'pending',
                lastError: error
            };
            this.pendingTasks.set(task.id, updatedTask);
            const delay = Math.min(this.config.retryDelayMs * Math.pow(this.config.backoffMultiplier, task.attemptCount), this.config.maxRetryDelayMs);
            setTimeout(() => this.scheduleExecution(), delay);
        }
        else {
            this.taskResults.set(task.id, {
                success: false,
                error,
                completedAt: new Date()
            });
        }
        this.scheduleExecution();
    }
    getPendingTasks() {
        return Array.from(this.pendingTasks.values());
    }
    getTaskStats() {
        const results = Array.from(this.taskResults.values());
        return {
            pending: this.pendingTasks.size,
            running: this.runningTasks.size,
            completed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        };
    }
}
exports.TaskQueue = TaskQueue;
function calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs, multiplier = 2) {
    return Math.min(baseDelayMs * Math.pow(multiplier, attempt), maxDelayMs);
}
function shouldRetry(attemptCount, maxAttempts) {
    return attemptCount < maxAttempts;
}
//# sourceMappingURL=backgroundTask.js.map