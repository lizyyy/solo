"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReviewTaskSummary = exports.updateReviewTaskStatus = exports.listReviewTasks = exports.getReviewTaskById = exports.createReviewTask = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
const historyService_1 = require("./historyService");
const sampleService_1 = require("./sampleService");
const createReviewTask = (data, operator) => {
    const sample = (0, sampleService_1.getSampleById)(data.sampleId);
    const now = new Date().toISOString();
    const task = {
        id: (0, uuid_1.v4)(),
        sampleId: data.sampleId,
        sampleNo: sample.sampleNo,
        assignee: data.assignee,
        taskType: data.taskType,
        status: 'PENDING',
        priority: data.priority || 'MEDIUM',
        dueDate: data.dueDate,
        createdBy: operator,
        createdAt: now,
        updatedAt: now
    };
    const stmt = database_1.default.prepare(`
    INSERT INTO review_tasks (id, sample_id, sample_no, assignee, task_type, status, priority, due_date, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(task.id, task.sampleId, task.sampleNo, task.assignee, task.taskType, task.status, task.priority, task.dueDate || null, task.createdBy, task.createdAt, task.updatedAt);
    (0, historyService_1.createHistoryRecord)('REVIEW_TASK', task.id, 'CREATE', `创建评审任务 - ${task.taskType}`, operator, undefined, task);
    return task;
};
exports.createReviewTask = createReviewTask;
const getReviewTaskById = (id) => {
    const row = database_1.default.prepare(`SELECT * FROM review_tasks WHERE id = ?`).get(id);
    if (!row) {
        throw new response_1.AppError(`评审任务 ${id} 不存在`, response_1.errorCodes.TASK_NOT_FOUND, 404);
    }
    return mapToReviewTask(row);
};
exports.getReviewTaskById = getReviewTaskById;
const listReviewTasks = (params = {}, page = 1, pageSize = 20) => {
    let query = `SELECT * FROM review_tasks WHERE 1=1`;
    const countQuery = `SELECT COUNT(*) as total FROM review_tasks WHERE 1=1`;
    const whereConditions = [];
    const queryParams = [];
    if (params.sampleId) {
        whereConditions.push(`sample_id = ?`);
        queryParams.push(params.sampleId);
    }
    if (params.assignee) {
        whereConditions.push(`assignee = ?`);
        queryParams.push(params.assignee);
    }
    if (params.status) {
        whereConditions.push(`status = ?`);
        queryParams.push(params.status);
    }
    if (params.taskType) {
        whereConditions.push(`task_type = ?`);
        queryParams.push(params.taskType);
    }
    if (params.priority) {
        whereConditions.push(`priority = ?`);
        queryParams.push(params.priority);
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
        items: rows.map(mapToReviewTask),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
};
exports.listReviewTasks = listReviewTasks;
const updateReviewTaskStatus = (id, newStatus, operator, data) => {
    const task = (0, exports.getReviewTaskById)(id);
    const validTransitions = {
        PENDING: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['COMPLETED', 'PENDING', 'CANCELLED'],
        COMPLETED: [],
        CANCELLED: []
    };
    if (!validTransitions[task.status].includes(newStatus)) {
        throw new response_1.AppError(`无效的任务状态转换: ${task.status} -> ${newStatus}`, response_1.errorCodes.INVALID_STATUS_TRANSITION, 400);
    }
    if (newStatus === 'COMPLETED') {
        if (!data?.opinion) {
            throw new response_1.AppError('完成评审任务需要填写评审意见', response_1.errorCodes.VALIDATION_ERROR, 400);
        }
        if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
            throw new response_1.AppError('评分必须在 1-5 之间', response_1.errorCodes.VALIDATION_ERROR, 400);
        }
    }
    const beforeState = { ...task };
    const now = new Date().toISOString();
    const updates = ['status = ?', 'updated_at = ?'];
    const updateParams = [newStatus, now];
    if (data?.opinion) {
        updates.push('opinion = ?');
        updateParams.push(data.opinion);
    }
    if (data?.rating !== undefined) {
        updates.push('rating = ?');
        updateParams.push(data.rating);
    }
    if (newStatus === 'COMPLETED') {
        updates.push('completed_at = ?');
        updateParams.push(now);
    }
    updateParams.push(id);
    database_1.default.prepare(`UPDATE review_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...updateParams);
    const updatedTask = (0, exports.getReviewTaskById)(id);
    if (newStatus === 'COMPLETED') {
        const sample = (0, sampleService_1.getSampleById)(task.sampleId);
        if (sample.status === 'PENDING_REVIEW') {
            const pendingTasks = (0, exports.listReviewTasks)({ sampleId: task.sampleId, status: 'PENDING' });
            const inProgressTasks = (0, exports.listReviewTasks)({ sampleId: task.sampleId, status: 'IN_PROGRESS' });
            if (pendingTasks.total === 0 && inProgressTasks.total === 0) {
                (0, sampleService_1.updateSampleStatus)(task.sampleId, 'REVIEWED', operator);
            }
        }
    }
    (0, historyService_1.createHistoryRecord)('REVIEW_TASK', id, 'STATUS_CHANGE', `任务状态从 ${task.status} 变更为 ${newStatus}`, operator, beforeState, updatedTask);
    return updatedTask;
};
exports.updateReviewTaskStatus = updateReviewTaskStatus;
const getReviewTaskSummary = (assignee) => {
    const now = new Date().toISOString();
    let query = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN task_type = 'INITIAL_REVIEW' THEN 1 ELSE 0 END) as initialReview,
      SUM(CASE WHEN task_type = 'TRIAL_REVIEW' THEN 1 ELSE 0 END) as trialReview,
      SUM(CASE WHEN task_type = 'FINAL_REVIEW' THEN 1 ELSE 0 END) as finalReview,
      SUM(CASE WHEN task_type = 'TECHNICAL_REVIEW' THEN 1 ELSE 0 END) as technicalReview,
      SUM(CASE WHEN task_type = 'QUALITY_REVIEW' THEN 1 ELSE 0 END) as qualityReview,
      SUM(CASE WHEN due_date IS NOT NULL AND due_date < ? AND status NOT IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END) as overdue
    FROM review_tasks
  `;
    const params = [now];
    if (assignee) {
        query += ' WHERE assignee = ?';
        params.push(assignee);
    }
    const result = database_1.default.prepare(query).get(...params);
    return {
        total: result.total || 0,
        byStatus: {
            PENDING: result.pending || 0,
            IN_PROGRESS: result.inProgress || 0,
            COMPLETED: result.completed || 0,
            CANCELLED: result.cancelled || 0
        },
        byType: {
            INITIAL_REVIEW: result.initialReview || 0,
            TRIAL_REVIEW: result.trialReview || 0,
            FINAL_REVIEW: result.finalReview || 0,
            TECHNICAL_REVIEW: result.technicalReview || 0,
            QUALITY_REVIEW: result.qualityReview || 0
        },
        overdue: result.overdue || 0
    };
};
exports.getReviewTaskSummary = getReviewTaskSummary;
const mapToReviewTask = (row) => ({
    id: row.id,
    sampleId: row.sample_id,
    sampleNo: row.sample_no,
    assignee: row.assignee,
    taskType: row.task_type,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    opinion: row.opinion,
    rating: row.rating,
    completedAt: row.completed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});
