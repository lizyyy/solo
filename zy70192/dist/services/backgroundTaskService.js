"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaskQueueStatus = exports.stopTaskQueue = exports.startTaskQueue = exports.cancelBackgroundTask = exports.retryBackgroundTask = exports.listBackgroundTasks = exports.getBackgroundTaskById = exports.createBackgroundTask = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
const exportService_1 = require("./exportService");
const TASK_INTERVAL = 5000;
const RETRY_DELAY = 30000;
let taskQueueRunning = false;
let taskInterval = null;
const taskHandlers = {
    GENERATE_REPORT: async (payload) => {
        if (!payload.sampleId) {
            throw new Error('缺少 sampleId 参数');
        }
        const csv = (0, exportService_1.exportSampleReportCSV)(payload.sampleId);
        return {
            sampleId: payload.sampleId,
            csv,
            fileName: `sample-report-${payload.sampleId}-${Date.now()}.csv`
        };
    },
    SEND_NOTIFICATION: async (payload) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
            recipient: payload.recipient,
            message: payload.message,
            sentAt: new Date().toISOString()
        };
    },
    EXPORT_DATA: async (payload) => {
        const overview = (0, exportService_1.getSystemOverview)();
        return {
            exportType: payload.exportType || 'overview',
            data: overview,
            exportedAt: new Date().toISOString()
        };
    },
    BATCH_UPDATE: async (payload) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return {
            updatedCount: payload.ids?.length || 0,
            completedAt: new Date().toISOString()
        };
    },
    SYNC_DATA: async (payload) => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            syncedFrom: payload.source || 'external',
            recordCount: payload.count || 0,
            syncedAt: new Date().toISOString()
        };
    }
};
const createBackgroundTask = (taskType, payload, maxRetries = 3) => {
    const now = new Date().toISOString();
    const task = {
        id: (0, uuid_1.v4)(),
        taskType,
        status: 'PENDING',
        payload,
        retryCount: 0,
        maxRetries,
        createdAt: now
    };
    const stmt = database_1.default.prepare(`
    INSERT INTO background_tasks (id, task_type, status, payload, retry_count, max_retries, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(task.id, task.taskType, task.status, JSON.stringify(task.payload), task.retryCount, task.maxRetries, task.createdAt);
    return task;
};
exports.createBackgroundTask = createBackgroundTask;
const getBackgroundTaskById = (id) => {
    const row = database_1.default.prepare(`SELECT * FROM background_tasks WHERE id = ?`).get(id);
    if (!row) {
        throw new response_1.AppError(`后台任务 ${id} 不存在`, response_1.errorCodes.NOT_FOUND, 404);
    }
    return mapToBackgroundTask(row);
};
exports.getBackgroundTaskById = getBackgroundTaskById;
const listBackgroundTasks = (params = {}, page = 1, pageSize = 20) => {
    let query = `SELECT * FROM background_tasks WHERE 1=1`;
    const countQuery = `SELECT COUNT(*) as total FROM background_tasks WHERE 1=1`;
    const whereConditions = [];
    const queryParams = [];
    if (params.status) {
        whereConditions.push(`status = ?`);
        queryParams.push(params.status);
    }
    if (params.taskType) {
        whereConditions.push(`task_type = ?`);
        queryParams.push(params.taskType);
    }
    if (whereConditions.length > 0) {
        query += ` AND ${whereConditions.join(' AND ')}`;
    }
    const countStmt = database_1.default.prepare(whereConditions.length > 0
        ? `${countQuery} AND ${whereConditions.join(' AND ')}`
        : countQuery);
    const countResult = countStmt.get(...queryParams);
    const total = countResult.total;
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const paginationParams = [...queryParams, pageSize, (page - 1) * pageSize];
    const rows = database_1.default.prepare(query).all(...paginationParams);
    return {
        items: rows.map(mapToBackgroundTask),
        total
    };
};
exports.listBackgroundTasks = listBackgroundTasks;
const retryBackgroundTask = (id) => {
    const task = (0, exports.getBackgroundTaskById)(id);
    if (task.status === 'RUNNING') {
        throw new response_1.AppError('任务正在执行中，无法重试', response_1.errorCodes.BAD_REQUEST, 400);
    }
    if (task.status === 'COMPLETED') {
        throw new response_1.AppError('任务已完成，无需重试', response_1.errorCodes.BAD_REQUEST, 400);
    }
    const now = new Date().toISOString();
    database_1.default.prepare(`
    UPDATE background_tasks
    SET status = 'PENDING', retry_count = 0, error_message = NULL, error_stack = NULL, next_retry_at = NULL, started_at = NULL, completed_at = NULL
    WHERE id = ?
  `).run(id);
    return (0, exports.getBackgroundTaskById)(id);
};
exports.retryBackgroundTask = retryBackgroundTask;
const cancelBackgroundTask = (id) => {
    const task = (0, exports.getBackgroundTaskById)(id);
    if (task.status === 'RUNNING') {
        throw new response_1.AppError('任务正在执行中，无法取消', response_1.errorCodes.BAD_REQUEST, 400);
    }
    if (task.status === 'COMPLETED') {
        throw new response_1.AppError('任务已完成，无法取消', response_1.errorCodes.BAD_REQUEST, 400);
    }
    database_1.default.prepare(`
    UPDATE background_tasks
    SET status = 'CANCELLED'
    WHERE id = ?
  `).run(id);
    return (0, exports.getBackgroundTaskById)(id);
};
exports.cancelBackgroundTask = cancelBackgroundTask;
const executeTask = async (task) => {
    const now = new Date().toISOString();
    database_1.default.prepare(`
    UPDATE background_tasks
    SET status = 'RUNNING', started_at = ?, retry_count = retry_count + 1
    WHERE id = ?
  `).run(now, task.id);
    try {
        const handler = taskHandlers[task.taskType];
        if (!handler) {
            throw new Error(`未知的任务类型: ${task.taskType}`);
        }
        const result = await handler(task.payload);
        const completedAt = new Date().toISOString();
        database_1.default.prepare(`
      UPDATE background_tasks
      SET status = 'COMPLETED', result = ?, completed_at = ?, error_message = NULL, error_stack = NULL, next_retry_at = NULL
      WHERE id = ?
    `).run(JSON.stringify(result), completedAt, task.id);
        console.log(`Task ${task.id} completed successfully`);
    }
    catch (error) {
        const failedAt = new Date().toISOString();
        const retryCount = task.retryCount + 1;
        let newStatus = 'FAILED';
        let nextRetryAt = null;
        if (retryCount < task.maxRetries) {
            newStatus = 'RETRYING';
            nextRetryAt = new Date(Date.now() + RETRY_DELAY).toISOString();
        }
        database_1.default.prepare(`
      UPDATE background_tasks
      SET status = ?, error_message = ?, error_stack = ?, next_retry_at = ?, completed_at = ?
      WHERE id = ?
    `).run(newStatus, error.message, error.stack, nextRetryAt, newStatus === 'FAILED' ? failedAt : null, task.id);
        console.log(`Task ${task.id} ${newStatus}: ${error.message}`);
    }
};
const getPendingTasks = () => {
    const now = new Date().toISOString();
    const rows = database_1.default.prepare(`
    SELECT * FROM background_tasks
    WHERE status = 'PENDING'
      OR (status = 'RETRYING' AND next_retry_at <= ?)
    ORDER BY created_at ASC
    LIMIT 10
  `).all(now);
    return rows.map(mapToBackgroundTask);
};
const processTasks = async () => {
    if (!taskQueueRunning)
        return;
    const tasks = getPendingTasks();
    for (const task of tasks) {
        if (!taskQueueRunning)
            break;
        try {
            await executeTask(task);
        }
        catch (error) {
            console.error(`Error processing task ${task.id}:`, error);
        }
    }
};
const startTaskQueue = () => {
    if (taskQueueRunning) {
        console.log('Task queue is already running');
        return;
    }
    taskQueueRunning = true;
    console.log('Task queue started');
    processTasks();
    taskInterval = setInterval(() => {
        if (taskQueueRunning) {
            processTasks();
        }
    }, TASK_INTERVAL);
};
exports.startTaskQueue = startTaskQueue;
const stopTaskQueue = () => {
    if (!taskQueueRunning) {
        console.log('Task queue is not running');
        return;
    }
    taskQueueRunning = false;
    if (taskInterval) {
        clearInterval(taskInterval);
        taskInterval = null;
    }
    console.log('Task queue stopped');
};
exports.stopTaskQueue = stopTaskQueue;
const getTaskQueueStatus = () => ({
    running: taskQueueRunning,
    intervalMs: TASK_INTERVAL,
    retryDelayMs: RETRY_DELAY
});
exports.getTaskQueueStatus = getTaskQueueStatus;
const mapToBackgroundTask = (row) => ({
    id: row.id,
    taskType: row.task_type,
    status: row.status,
    payload: JSON.parse(row.payload),
    result: row.result ? JSON.parse(row.result) : undefined,
    errorMessage: row.error_message,
    errorStack: row.error_stack,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    nextRetryAt: row.next_retry_at
});
