"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTask = createTask;
exports.startTask = startTask;
exports.completeTask = completeTask;
exports.failTask = failTask;
exports.setManualTask = setManualTask;
exports.retryTask = retryTask;
exports.getTask = getTask;
exports.getTasksByStatus = getTasksByStatus;
exports.getPendingTasks = getPendingTasks;
exports.getRetryTasks = getRetryTasks;
exports.getManualTasks = getManualTasks;
exports.getFailedTasks = getFailedTasks;
exports.getTasksByBatch = getTasksByBatch;
exports.processPendingTasks = processPendingTasks;
const database_1 = require("../db/database");
const utils_1 = require("../utils");
const types_1 = require("../types");
function createTask(options) {
    const db = (0, database_1.getDatabase)();
    const taskId = (0, utils_1.generateId)();
    const stmt = db.prepare(`
    INSERT INTO async_tasks (
      id, batch_id, task_type, status, retry_count, max_retries, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(taskId, options.batchId || null, options.taskType, types_1.TaskStatus.PENDING, 0, options.maxRetries || 3, (0, utils_1.now)(), (0, utils_1.now)());
    return taskId;
}
function startTask(taskId) {
    const db = (0, database_1.getDatabase)();
    const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, updated_at = ? 
    WHERE id = ?
  `);
    stmt.run(types_1.TaskStatus.PROCESSING, (0, utils_1.now)(), taskId);
}
function completeTask(taskId) {
    const db = (0, database_1.getDatabase)();
    const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, processed_at = ?, updated_at = ? 
    WHERE id = ?
  `);
    stmt.run(types_1.TaskStatus.COMPLETED, (0, utils_1.now)(), (0, utils_1.now)(), taskId);
}
function failTask(taskId, error) {
    const db = (0, database_1.getDatabase)();
    const task = db.prepare(`
    SELECT retry_count, max_retries FROM async_tasks WHERE id = ?
  `).get(taskId);
    if (!task) {
        throw new Error(`Task ${taskId} not found`);
    }
    const newRetryCount = task.retry_count + 1;
    let newStatus;
    if (newRetryCount >= task.max_retries) {
        newStatus = types_1.TaskStatus.PERMANENT_FAILED;
    }
    else if (error.message.includes('manual') || error.message.includes('人工')) {
        newStatus = types_1.TaskStatus.MANUAL;
    }
    else {
        newStatus = types_1.TaskStatus.RETRY;
    }
    const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, retry_count = ?, error_message = ?, error_stack = ?, updated_at = ? 
    WHERE id = ?
  `);
    stmt.run(newStatus, newRetryCount, error.message, error.stack || null, (0, utils_1.now)(), taskId);
    return newStatus;
}
function setManualTask(taskId) {
    const db = (0, database_1.getDatabase)();
    const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, updated_at = ? 
    WHERE id = ?
  `);
    stmt.run(types_1.TaskStatus.MANUAL, (0, utils_1.now)(), taskId);
}
function retryTask(taskId) {
    const db = (0, database_1.getDatabase)();
    const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, updated_at = ? 
    WHERE id = ?
  `);
    stmt.run(types_1.TaskStatus.PENDING, (0, utils_1.now)(), taskId);
}
function getTask(taskId) {
    const db = (0, database_1.getDatabase)();
    return db.prepare('SELECT * FROM async_tasks WHERE id = ?').get(taskId);
}
function getTasksByStatus(status) {
    const db = (0, database_1.getDatabase)();
    return db.prepare(`
    SELECT * FROM async_tasks 
    WHERE status = ? 
    ORDER BY created_at ASC
  `).all(status);
}
function getPendingTasks() {
    return getTasksByStatus(types_1.TaskStatus.PENDING);
}
function getRetryTasks() {
    return getTasksByStatus(types_1.TaskStatus.RETRY);
}
function getManualTasks() {
    return getTasksByStatus(types_1.TaskStatus.MANUAL);
}
function getFailedTasks() {
    return getTasksByStatus(types_1.TaskStatus.PERMANENT_FAILED);
}
function getTasksByBatch(batchId) {
    const db = (0, database_1.getDatabase)();
    return db.prepare(`
    SELECT * FROM async_tasks 
    WHERE batch_id = ? 
    ORDER BY created_at DESC
  `).all(batchId);
}
function processPendingTasks(processor) {
    const pendingTasks = [...getPendingTasks(), ...getRetryTasks()];
    for (const task of pendingTasks) {
        startTask(task.id);
        processor(task)
            .then(() => completeTask(task.id))
            .catch((err) => failTask(task.id, { message: err.message, stack: err.stack }));
    }
}
