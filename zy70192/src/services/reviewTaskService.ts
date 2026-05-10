import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { ReviewTask, ReviewTaskType, TaskStatus, PaginatedResponse } from '../types';
import { AppError, errorCodes } from '../utils/response';
import { createHistoryRecord } from './historyService';
import { getSampleById, updateSampleStatus } from './sampleService';

export const createReviewTask = (
  data: {
    sampleId: string;
    assignee: string;
    taskType: ReviewTaskType;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    dueDate?: string;
  },
  operator: string
): ReviewTask => {
  const sample = getSampleById(data.sampleId);
  const now = new Date().toISOString();

  const task: ReviewTask = {
    id: uuidv4(),
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

  const stmt = db.prepare(`
    INSERT INTO review_tasks (id, sample_id, sample_no, assignee, task_type, status, priority, due_date, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    task.id,
    task.sampleId,
    task.sampleNo,
    task.assignee,
    task.taskType,
    task.status,
    task.priority,
    task.dueDate || null,
    task.createdBy,
    task.createdAt,
    task.updatedAt
  );

  createHistoryRecord(
    'REVIEW_TASK',
    task.id,
    'CREATE',
    `创建评审任务 - ${task.taskType}`,
    operator,
    undefined,
    task
  );

  return task;
};

export const getReviewTaskById = (id: string): ReviewTask => {
  const row = db.prepare(`SELECT * FROM review_tasks WHERE id = ?`).get(id) as any;
  if (!row) {
    throw new AppError(`评审任务 ${id} 不存在`, errorCodes.TASK_NOT_FOUND, 404);
  }
  return mapToReviewTask(row);
};

export const listReviewTasks = (
  params: {
    sampleId?: string;
    assignee?: string;
    status?: TaskStatus;
    taskType?: ReviewTaskType;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  } = {},
  page: number = 1,
  pageSize: number = 20
): PaginatedResponse<ReviewTask> => {
  let query = `SELECT * FROM review_tasks WHERE 1=1`;
  const countQuery = `SELECT COUNT(*) as total FROM review_tasks WHERE 1=1`;
  const whereConditions: string[] = [];
  const queryParams: any[] = [];

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

  const countStmt = db.prepare(
    whereConditions.length > 0 
      ? `${countQuery} AND ${whereConditions.join(' AND ')}`
      : countQuery
  );
  const countResult = countStmt.get(...queryParams) as { total: number };
  const total = countResult.total;

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const paginationParams = [...queryParams, pageSize, (page - 1) * pageSize];

  const rows = db.prepare(query).all(...paginationParams) as any[];

  return {
    items: rows.map(mapToReviewTask),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
};

export const updateReviewTaskStatus = (
  id: string,
  newStatus: TaskStatus,
  operator: string,
  data?: {
    opinion?: string;
    rating?: number;
  }
): ReviewTask => {
  const task = getReviewTaskById(id);

  const validTransitions: Record<TaskStatus, TaskStatus[]> = {
    PENDING: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'PENDING', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: []
  };

  if (!validTransitions[task.status].includes(newStatus)) {
    throw new AppError(
      `无效的任务状态转换: ${task.status} -> ${newStatus}`,
      errorCodes.INVALID_STATUS_TRANSITION,
      400
    );
  }

  if (newStatus === 'COMPLETED') {
    if (!data?.opinion) {
      throw new AppError('完成评审任务需要填写评审意见', errorCodes.VALIDATION_ERROR, 400);
    }
    if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
      throw new AppError('评分必须在 1-5 之间', errorCodes.VALIDATION_ERROR, 400);
    }
  }

  const beforeState = { ...task };
  const now = new Date().toISOString();
  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const updateParams: any[] = [newStatus, now];

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

  db.prepare(`UPDATE review_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...updateParams);

  const updatedTask = getReviewTaskById(id);

  if (newStatus === 'COMPLETED') {
    const sample = getSampleById(task.sampleId);
    if (sample.status === 'PENDING_REVIEW') {
      const pendingTasks = listReviewTasks({ sampleId: task.sampleId, status: 'PENDING' });
      const inProgressTasks = listReviewTasks({ sampleId: task.sampleId, status: 'IN_PROGRESS' });
      
      if (pendingTasks.total === 0 && inProgressTasks.total === 0) {
        updateSampleStatus(task.sampleId, 'REVIEWED', operator);
      }
    }
  }

  createHistoryRecord(
    'REVIEW_TASK',
    id,
    'STATUS_CHANGE',
    `任务状态从 ${task.status} 变更为 ${newStatus}`,
    operator,
    beforeState,
    updatedTask
  );

  return updatedTask;
};

export const getReviewTaskSummary = (assignee?: string): {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byType: Record<ReviewTaskType, number>;
  overdue: number;
} => {
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
  const params: any[] = [now];

  if (assignee) {
    query += ' WHERE assignee = ?';
    params.push(assignee);
  }

  const result = db.prepare(query).get(...params) as any;

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

const mapToReviewTask = (row: any): ReviewTask => ({
  id: row.id,
  sampleId: row.sample_id,
  sampleNo: row.sample_no,
  assignee: row.assignee,
  taskType: row.task_type as ReviewTaskType,
  status: row.status as TaskStatus,
  priority: row.priority as 'HIGH' | 'MEDIUM' | 'LOW',
  dueDate: row.due_date,
  opinion: row.opinion,
  rating: row.rating,
  completedAt: row.completed_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
