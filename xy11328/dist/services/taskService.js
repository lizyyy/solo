"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskService = exports.TaskService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../models/types");
const storage_1 = require("./storage");
const sensitiveMask_1 = require("../utils/sensitiveMask");
const logger = (0, sensitiveMask_1.createSensitiveLogger)();
class TaskService {
    generateIdempotencyKey(operation, data) {
        const dataStr = JSON.stringify(data);
        return `${operation}-${Buffer.from(dataStr).toString('base64').slice(0, 32)}`;
    }
    checkIdempotency(key) {
        const record = storage_1.storage.getIdempotencyRecord(key);
        if (record) {
            const task = storage_1.storage.getTaskById(record.taskId);
            if (task) {
                logger.info('检测到重复请求，返回已有结果', { idempotencyKey: key });
                return task;
            }
        }
        return null;
    }
    createTask(patient, checkType, checkLocation, priority = types_1.TaskPriority.NORMAL, remarks, idempotencyKey) {
        const key = idempotencyKey || this.generateIdempotencyKey('create', { patient, checkType, checkLocation });
        const existingTask = this.checkIdempotency(key);
        if (existingTask) {
            return existingTask;
        }
        const now = Date.now();
        const task = {
            id: (0, uuid_1.v4)(),
            idempotencyKey: key,
            patientId: patient.id,
            patient,
            status: types_1.TaskStatus.PENDING,
            priority,
            checkType,
            checkLocation,
            createdAt: now,
            remarks,
            transferHistory: []
        };
        storage_1.storage.saveTask(task);
        storage_1.storage.saveIdempotencyRecord({
            key,
            taskId: task.id,
            operation: 'create',
            createdAt: now
        });
        logger.info('任务创建成功', { taskId: task.id });
        return task;
    }
    assignTask(taskId, escortId, operator, idempotencyKey) {
        const key = idempotencyKey || this.generateIdempotencyKey('assign', { taskId, escortId });
        const existingTask = this.checkIdempotency(key);
        if (existingTask) {
            return existingTask;
        }
        const task = storage_1.storage.getTaskById(taskId);
        if (!task) {
            throw new Error('任务不存在');
        }
        if (task.status !== types_1.TaskStatus.PENDING && task.status !== types_1.TaskStatus.ASSIGNED) {
            throw new Error('当前任务状态不允许派单');
        }
        const escort = storage_1.storage.getEscortById(escortId);
        if (!escort) {
            throw new Error('陪检员不存在');
        }
        if (escort.status !== 'available') {
            throw new Error('陪检员当前不可用');
        }
        const now = Date.now();
        task.escortId = escortId;
        task.escort = escort;
        task.status = types_1.TaskStatus.ASSIGNED;
        task.assignedAt = now;
        escort.status = 'busy';
        escort.currentTaskId = taskId;
        storage_1.storage.saveEscort(escort);
        storage_1.storage.saveTask(task);
        storage_1.storage.saveIdempotencyRecord({
            key,
            taskId: task.id,
            operation: 'assign',
            createdAt: now
        });
        logger.info('任务派单成功', { taskId, escortId, operator });
        return task;
    }
    acceptTask(taskId, escortId, idempotencyKey) {
        const key = idempotencyKey || this.generateIdempotencyKey('accept', { taskId, escortId });
        const existingTask = this.checkIdempotency(key);
        if (existingTask) {
            return existingTask;
        }
        const task = storage_1.storage.getTaskById(taskId);
        if (!task) {
            throw new Error('任务不存在');
        }
        if (task.status !== types_1.TaskStatus.ASSIGNED) {
            throw new Error('当前任务状态不允许接单');
        }
        if (task.escortId !== escortId) {
            throw new Error('只能接分配给自己的任务');
        }
        const now = Date.now();
        task.status = types_1.TaskStatus.IN_PROGRESS;
        task.startedAt = now;
        task.acceptedAt = now;
        const waitTimeMs = now - task.createdAt;
        task.waitTimeMinutes = Math.round(waitTimeMs / 60000);
        storage_1.storage.saveTask(task);
        storage_1.storage.saveIdempotencyRecord({
            key,
            taskId: task.id,
            operation: 'accept',
            createdAt: now
        });
        logger.info('任务接单成功', { taskId, escortId });
        return task;
    }
    transferTask(taskId, fromEscortId, toEscortId, reason, operator, idempotencyKey) {
        const key = idempotencyKey || this.generateIdempotencyKey('transfer', { taskId, fromEscortId, toEscortId });
        const existingTask = this.checkIdempotency(key);
        if (existingTask) {
            return existingTask;
        }
        const task = storage_1.storage.getTaskById(taskId);
        if (!task) {
            throw new Error('任务不存在');
        }
        if (task.status !== types_1.TaskStatus.ASSIGNED && task.status !== types_1.TaskStatus.IN_PROGRESS) {
            throw new Error('当前任务状态不允许转派');
        }
        if (task.escortId !== fromEscortId) {
            throw new Error('只能转派分配给自己的任务');
        }
        const fromEscort = storage_1.storage.getEscortById(fromEscortId);
        const toEscort = storage_1.storage.getEscortById(toEscortId);
        if (!fromEscort || !toEscort) {
            throw new Error('陪检员不存在');
        }
        if (toEscort.status !== 'available') {
            throw new Error('目标陪检员当前不可用');
        }
        const now = Date.now();
        const transferRecord = {
            id: (0, uuid_1.v4)(),
            fromEscortId,
            toEscortId,
            transferredAt: now,
            reason,
            operator
        };
        task.transferHistory.push(transferRecord);
        task.escortId = toEscortId;
        task.escort = toEscort;
        task.status = types_1.TaskStatus.ASSIGNED;
        task.assignedAt = now;
        fromEscort.status = 'available';
        fromEscort.currentTaskId = undefined;
        storage_1.storage.saveEscort(fromEscort);
        toEscort.status = 'busy';
        toEscort.currentTaskId = taskId;
        storage_1.storage.saveEscort(toEscort);
        storage_1.storage.saveTask(task);
        storage_1.storage.saveIdempotencyRecord({
            key,
            taskId: task.id,
            operation: 'transfer',
            createdAt: now
        });
        logger.info('任务转派成功', { taskId, fromEscortId, toEscortId, operator });
        return task;
    }
    completeTask(taskId, escortId, idempotencyKey) {
        const key = idempotencyKey || this.generateIdempotencyKey('complete', { taskId, escortId });
        const existingTask = this.checkIdempotency(key);
        if (existingTask) {
            return existingTask;
        }
        const task = storage_1.storage.getTaskById(taskId);
        if (!task) {
            throw new Error('任务不存在');
        }
        if (task.status !== types_1.TaskStatus.IN_PROGRESS) {
            throw new Error('当前任务状态不允许完成');
        }
        if (task.escortId !== escortId) {
            throw new Error('只能完成分配给自己的任务');
        }
        const now = Date.now();
        task.status = types_1.TaskStatus.COMPLETED;
        task.completedAt = now;
        if (task.startedAt) {
            const serviceTimeMs = now - task.startedAt;
            task.serviceTimeMinutes = Math.round(serviceTimeMs / 60000);
        }
        const escort = storage_1.storage.getEscortById(escortId);
        if (escort) {
            escort.status = 'available';
            escort.currentTaskId = undefined;
            storage_1.storage.saveEscort(escort);
        }
        storage_1.storage.saveTask(task);
        storage_1.storage.saveIdempotencyRecord({
            key,
            taskId: task.id,
            operation: 'complete',
            createdAt: now
        });
        logger.info('任务完成', { taskId, escortId });
        return task;
    }
    cancelTask(taskId, reason, operator, idempotencyKey) {
        const key = idempotencyKey || this.generateIdempotencyKey('cancel', { taskId, reason });
        const existingTask = this.checkIdempotency(key);
        if (existingTask) {
            return existingTask;
        }
        const task = storage_1.storage.getTaskById(taskId);
        if (!task) {
            throw new Error('任务不存在');
        }
        if (task.status === types_1.TaskStatus.COMPLETED || task.status === types_1.TaskStatus.CANCELLED) {
            throw new Error('当前任务状态不允许取消');
        }
        const now = Date.now();
        task.status = types_1.TaskStatus.CANCELLED;
        task.cancelledAt = now;
        task.remarks = task.remarks ? `${task.remarks} | 取消原因: ${reason}` : `取消原因: ${reason}`;
        if (task.escortId) {
            const escort = storage_1.storage.getEscortById(task.escortId);
            if (escort) {
                escort.status = 'available';
                escort.currentTaskId = undefined;
                storage_1.storage.saveEscort(escort);
            }
        }
        storage_1.storage.saveTask(task);
        storage_1.storage.saveIdempotencyRecord({
            key,
            taskId: task.id,
            operation: 'cancel',
            createdAt: now
        });
        logger.info('任务已取消', { taskId, operator });
        return task;
    }
    timeoutTask(taskId, idempotencyKey) {
        const key = idempotencyKey || this.generateIdempotencyKey('timeout', { taskId });
        const existingTask = this.checkIdempotency(key);
        if (existingTask) {
            return existingTask;
        }
        const task = storage_1.storage.getTaskById(taskId);
        if (!task) {
            throw new Error('任务不存在');
        }
        if (task.status !== types_1.TaskStatus.PENDING && task.status !== types_1.TaskStatus.ASSIGNED) {
            throw new Error('当前任务状态不能标记为超时');
        }
        const now = Date.now();
        task.status = types_1.TaskStatus.TIMEOUT;
        task.timeoutAt = now;
        if (task.escortId) {
            const escort = storage_1.storage.getEscortById(task.escortId);
            if (escort) {
                escort.status = 'available';
                escort.currentTaskId = undefined;
                storage_1.storage.saveEscort(escort);
            }
        }
        storage_1.storage.saveTask(task);
        storage_1.storage.saveIdempotencyRecord({
            key,
            taskId: task.id,
            operation: 'timeout',
            createdAt: now
        });
        logger.warn('任务已超时', { taskId });
        return task;
    }
    getTaskById(taskId) {
        return storage_1.storage.getTaskById(taskId);
    }
    getTasksByStatus(status) {
        return storage_1.storage.getTasks().filter(t => t.status === status);
    }
    getTasksByEscort(escortId) {
        return storage_1.storage.getTasks().filter(t => t.escortId === escortId);
    }
    getAllTasks() {
        return storage_1.storage.getTasks();
    }
    getStatistics(startTime, endTime) {
        let tasks = storage_1.storage.getTasks();
        if (startTime) {
            tasks = tasks.filter(t => t.createdAt >= startTime);
        }
        if (endTime) {
            tasks = tasks.filter(t => t.createdAt <= endTime);
        }
        const completedTasks = tasks.filter(t => t.status === types_1.TaskStatus.COMPLETED);
        const waitTimes = completedTasks
            .map(t => t.waitTimeMinutes || 0)
            .filter(t => t > 0);
        const serviceTimes = completedTasks
            .map(t => t.serviceTimeMinutes || 0)
            .filter(t => t > 0);
        const tasksByEscort = {};
        for (const escort of storage_1.storage.getEscorts()) {
            const escortTasks = tasks.filter(t => t.escortId === escort.id);
            tasksByEscort[escort.id] = {
                name: escort.name,
                completed: escortTasks.filter(t => t.status === types_1.TaskStatus.COMPLETED).length,
                inProgress: escortTasks.filter(t => t.status === types_1.TaskStatus.IN_PROGRESS).length
            };
        }
        return {
            totalTasks: tasks.length,
            pendingTasks: tasks.filter(t => t.status === types_1.TaskStatus.PENDING).length,
            inProgressTasks: tasks.filter(t => t.status === types_1.TaskStatus.IN_PROGRESS).length,
            completedTasks: completedTasks.length,
            cancelledTasks: tasks.filter(t => t.status === types_1.TaskStatus.CANCELLED).length,
            timeoutTasks: tasks.filter(t => t.status === types_1.TaskStatus.TIMEOUT).length,
            avgWaitTimeMinutes: waitTimes.length > 0
                ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length * 100) / 100
                : 0,
            avgServiceTimeMinutes: serviceTimes.length > 0
                ? Math.round(serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length * 100) / 100
                : 0,
            maxWaitTimeMinutes: waitTimes.length > 0 ? Math.max(...waitTimes) : 0,
            tasksByPriority: {
                [types_1.TaskPriority.NORMAL]: tasks.filter(t => t.priority === types_1.TaskPriority.NORMAL).length,
                [types_1.TaskPriority.URGENT]: tasks.filter(t => t.priority === types_1.TaskPriority.URGENT).length,
                [types_1.TaskPriority.EMERGENCY]: tasks.filter(t => t.priority === types_1.TaskPriority.EMERGENCY).length
            },
            tasksByEscort
        };
    }
    cleanupExpiredIdempotencyRecords() {
        return storage_1.storage.clearExpiredIdempotencyRecords();
    }
}
exports.TaskService = TaskService;
exports.taskService = new TaskService();
