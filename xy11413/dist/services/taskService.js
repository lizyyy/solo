"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetProcessingTasks = exports.assignTask = exports.updateManualOpinion = exports.failTask = exports.completeTask = exports.startTask = exports.getAllTasks = exports.getTasksByStatus = exports.getPendingTasks = exports.getTaskById = exports.createTask = void 0;
const connection_1 = require("../database/connection");
const schema_1 = require("../database/schema");
const factId_1 = require("../utils/factId");
const createTask = async (taskType, payload, maxRetries = 3) => {
    const taskId = (0, factId_1.generateTaskId)();
    await (0, connection_1.runInsert)(`INSERT INTO ${schema_1.TABLES.VERIFICATION_TASKS} (
      task_id, task_type, status, payload, max_retries
    ) VALUES (?, ?, ?, ?, ?)`, [taskId, taskType, 'pending', JSON.stringify(payload), maxRetries]);
    return taskId;
};
exports.createTask = createTask;
const getTaskById = async (taskId) => {
    const records = await (0, connection_1.runQuery)(`SELECT * FROM ${schema_1.TABLES.VERIFICATION_TASKS} WHERE task_id = ?`, [taskId]);
    if (records.length === 0)
        return null;
    return mapToVerificationTask(records[0]);
};
exports.getTaskById = getTaskById;
const getPendingTasks = async () => {
    const records = await (0, connection_1.runQuery)(`SELECT * FROM ${schema_1.TABLES.VERIFICATION_TASKS} 
     WHERE status IN ('pending', 'waiting_retry')
     ORDER BY created_at ASC`);
    return records.map(mapToVerificationTask);
};
exports.getPendingTasks = getPendingTasks;
const getTasksByStatus = async (status) => {
    const records = await (0, connection_1.runQuery)(`SELECT * FROM ${schema_1.TABLES.VERIFICATION_TASKS} WHERE status = ? ORDER BY created_at DESC`, [status]);
    return records.map(mapToVerificationTask);
};
exports.getTasksByStatus = getTasksByStatus;
const getAllTasks = async () => {
    const records = await (0, connection_1.runQuery)(`SELECT * FROM ${schema_1.TABLES.VERIFICATION_TASKS} ORDER BY created_at DESC`);
    return records.map(mapToVerificationTask);
};
exports.getAllTasks = getAllTasks;
const startTask = async (taskId) => {
    const changes = await (0, connection_1.runUpdate)(`UPDATE ${schema_1.TABLES.VERIFICATION_TASKS} 
     SET status = 'processing', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ? AND status IN ('pending', 'waiting_retry')`, [taskId]);
    return changes > 0;
};
exports.startTask = startTask;
const completeTask = async (taskId) => {
    const changes = await (0, connection_1.runUpdate)(`UPDATE ${schema_1.TABLES.VERIFICATION_TASKS} 
     SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ?`, [taskId]);
    return changes > 0;
};
exports.completeTask = completeTask;
const failTask = async (taskId, failureReason, category) => {
    const task = await (0, exports.getTaskById)(taskId);
    if (!task)
        throw new Error(`Task not found: ${taskId}`);
    const newRetryCount = task.retryCount + 1;
    if (category === 'permanent') {
        await (0, connection_1.runUpdate)(`UPDATE ${schema_1.TABLES.VERIFICATION_TASKS} 
       SET status = 'permanent_failed', 
           failure_category = 'permanent',
           failure_reason = ?,
           retry_count = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE task_id = ?`, [failureReason, newRetryCount, taskId]);
        return 'permanent_failed';
    }
    if (category === 'needs_manual') {
        await (0, connection_1.runUpdate)(`UPDATE ${schema_1.TABLES.VERIFICATION_TASKS} 
       SET status = 'waiting_manual', 
           failure_category = 'needs_manual',
           failure_reason = ?,
           retry_count = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE task_id = ?`, [failureReason, newRetryCount, taskId]);
        return 'waiting_manual';
    }
    if (newRetryCount >= task.maxRetries) {
        await (0, connection_1.runUpdate)(`UPDATE ${schema_1.TABLES.VERIFICATION_TASKS} 
       SET status = 'permanent_failed', 
           failure_category = 'permanent',
           failure_reason = ?,
           retry_count = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE task_id = ?`, [`已达最大重试次数: ${failureReason}`, newRetryCount, taskId]);
        return 'permanent_failed';
    }
    await (0, connection_1.runUpdate)(`UPDATE ${schema_1.TABLES.VERIFICATION_TASKS} 
     SET status = 'waiting_retry', 
         failure_category = 'retryable',
         failure_reason = ?,
         retry_count = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ?`, [failureReason, newRetryCount, taskId]);
    return 'waiting_retry';
};
exports.failTask = failTask;
const updateManualOpinion = async (taskId, opinion, resolved) => {
    const status = resolved ? 'pending' : 'waiting_manual';
    const changes = await (0, connection_1.runUpdate)(`UPDATE ${schema_1.TABLES.VERIFICATION_TASKS} 
     SET manual_opinion = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ? AND status = 'waiting_manual'`, [opinion, status, taskId]);
    return changes > 0;
};
exports.updateManualOpinion = updateManualOpinion;
const assignTask = async (taskId, assignedTo) => {
    const changes = await (0, connection_1.runUpdate)(`UPDATE ${schema_1.TABLES.VERIFICATION_TASKS} 
     SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ?`, [assignedTo, taskId]);
    return changes > 0;
};
exports.assignTask = assignTask;
const resetProcessingTasks = async () => {
    const changes = await (0, connection_1.runUpdate)(`UPDATE ${schema_1.TABLES.VERIFICATION_TASKS} 
     SET status = CASE 
       WHEN retry_count < max_retries THEN 'waiting_retry'
       ELSE 'permanent_failed'
     END,
     updated_at = CURRENT_TIMESTAMP
     WHERE status = 'processing'`);
    console.log(`已重置 ${changes} 个处理中的任务`);
    return changes;
};
exports.resetProcessingTasks = resetProcessingTasks;
const mapToVerificationTask = (record) => ({
    taskId: record.task_id,
    taskType: record.task_type,
    status: record.status,
    payload: record.payload,
    retryCount: record.retry_count,
    maxRetries: record.max_retries,
    failureCategory: record.failure_category,
    failureReason: record.failure_reason,
    manualOpinion: record.manual_opinion,
    assignedTo: record.assigned_to,
    startedAt: record.started_at,
    completedAt: record.completed_at
});
