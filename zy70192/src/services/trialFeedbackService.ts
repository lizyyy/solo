import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { TrialFeedback, PaginatedResponse } from '../types';
import { AppError, errorCodes } from '../utils/response';
import { createHistoryRecord } from './historyService';
import { getSampleById, updateSampleStatus } from './sampleService';

export const createTrialFeedback = (
  data: {
    sampleId: string;
    trialUser: string;
    trialDate: string;
    trialPeriod: number;
    trialLocation: string;
    testItems: Array<{
      name: string;
      criteria: string;
      result: 'PASS' | 'FAIL' | 'PARTIAL';
      remarks?: string;
    }>;
    overallRating: number;
    conclusion: string;
    suggestions?: string;
    attachments?: string[];
  },
  operator: string
): TrialFeedback => {
  const sample = getSampleById(data.sampleId);

  if (sample.status !== 'IN_TRIAL') {
    throw new AppError('只有试用中的样品才能提交试用反馈', errorCodes.BAD_REQUEST, 400);
  }

  if (data.overallRating < 1 || data.overallRating > 5) {
    throw new AppError('综合评分必须在 1-5 之间', errorCodes.VALIDATION_ERROR, 400);
  }

  if (!data.testItems || data.testItems.length === 0) {
    throw new AppError('必须至少包含一个测试项', errorCodes.VALIDATION_ERROR, 400);
  }

  const now = new Date().toISOString();

  const feedback: TrialFeedback = {
    id: uuidv4(),
    sampleId: data.sampleId,
    sampleNo: sample.sampleNo,
    trialUser: data.trialUser,
    trialDate: data.trialDate,
    trialPeriod: data.trialPeriod,
    trialLocation: data.trialLocation,
    testItems: data.testItems,
    overallRating: data.overallRating,
    conclusion: data.conclusion,
    suggestions: data.suggestions,
    attachments: data.attachments,
    createdBy: operator,
    createdAt: now
  };

  const stmt = db.prepare(`
    INSERT INTO trial_feedbacks (id, sample_id, sample_no, trial_user, trial_date, trial_period, trial_location, test_items, overall_rating, conclusion, suggestions, attachments, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    feedback.id,
    feedback.sampleId,
    feedback.sampleNo,
    feedback.trialUser,
    feedback.trialDate,
    feedback.trialPeriod,
    feedback.trialLocation,
    JSON.stringify(feedback.testItems),
    feedback.overallRating,
    feedback.conclusion,
    feedback.suggestions || null,
    feedback.attachments ? JSON.stringify(feedback.attachments) : null,
    feedback.createdBy,
    feedback.createdAt
  );

  updateSampleStatus(data.sampleId, 'PENDING_REVIEW', operator);

  createHistoryRecord(
    'TRIAL_FEEDBACK',
    feedback.id,
    'CREATE',
    `提交试用反馈 - 评分: ${feedback.overallRating}`,
    operator,
    undefined,
    feedback
  );

  return feedback;
};

export const getTrialFeedbackById = (id: string): TrialFeedback => {
  const row = db.prepare(`SELECT * FROM trial_feedbacks WHERE id = ?`).get(id) as any;
  if (!row) {
    throw new AppError(`试用反馈 ${id} 不存在`, errorCodes.NOT_FOUND, 404);
  }
  return mapToTrialFeedback(row);
};

export const getTrialFeedbacksBySample = (sampleId: string): TrialFeedback[] => {
  const rows = db.prepare(`
    SELECT * FROM trial_feedbacks 
    WHERE sample_id = ? 
    ORDER BY created_at DESC
  `).all(sampleId) as any[];
  return rows.map(mapToTrialFeedback);
};

export const listTrialFeedbacks = (
  params: {
    sampleId?: string;
    trialUser?: string;
    minRating?: number;
    maxRating?: number;
  } = {},
  page: number = 1,
  pageSize: number = 20
): PaginatedResponse<TrialFeedback> => {
  let query = `SELECT * FROM trial_feedbacks WHERE 1=1`;
  const countQuery = `SELECT COUNT(*) as total FROM trial_feedbacks WHERE 1=1`;
  const whereConditions: string[] = [];
  const queryParams: any[] = [];

  if (params.sampleId) {
    whereConditions.push(`sample_id = ?`);
    queryParams.push(params.sampleId);
  }
  if (params.trialUser) {
    whereConditions.push(`trial_user LIKE ?`);
    queryParams.push(`%${params.trialUser}%`);
  }
  if (params.minRating !== undefined) {
    whereConditions.push(`overall_rating >= ?`);
    queryParams.push(params.minRating);
  }
  if (params.maxRating !== undefined) {
    whereConditions.push(`overall_rating <= ?`);
    queryParams.push(params.maxRating);
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
    items: rows.map(mapToTrialFeedback),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
};

export const getTrialFeedbackSummary = (sampleId?: string): {
  total: number;
  avgRating: number;
  passRate: number;
  byRating: Record<number, number>;
} => {
  let query = `
    SELECT 
      COUNT(*) as total,
      AVG(overall_rating) as avgRating,
      SUM(CASE WHEN overall_rating >= 4 THEN 1 ELSE 0 END) as passCount,
      SUM(CASE WHEN overall_rating = 1 THEN 1 ELSE 0 END) as rating1,
      SUM(CASE WHEN overall_rating = 2 THEN 1 ELSE 0 END) as rating2,
      SUM(CASE WHEN overall_rating = 3 THEN 1 ELSE 0 END) as rating3,
      SUM(CASE WHEN overall_rating = 4 THEN 1 ELSE 0 END) as rating4,
      SUM(CASE WHEN overall_rating = 5 THEN 1 ELSE 0 END) as rating5
    FROM trial_feedbacks
  `;
  const params: any[] = [];

  if (sampleId) {
    query += ' WHERE sample_id = ?';
    params.push(sampleId);
  }

  const result = db.prepare(query).get(...params) as any;
  const total = result.total || 0;

  return {
    total,
    avgRating: result.avgRating || 0,
    passRate: total > 0 ? (result.passCount || 0) / total : 0,
    byRating: {
      1: result.rating1 || 0,
      2: result.rating2 || 0,
      3: result.rating3 || 0,
      4: result.rating4 || 0,
      5: result.rating5 || 0
    }
  };
};

const mapToTrialFeedback = (row: any): TrialFeedback => ({
  id: row.id,
  sampleId: row.sample_id,
  sampleNo: row.sample_no,
  trialUser: row.trial_user,
  trialDate: row.trial_date,
  trialPeriod: row.trial_period,
  trialLocation: row.trial_location,
  testItems: JSON.parse(row.test_items),
  overallRating: row.overall_rating,
  conclusion: row.conclusion,
  suggestions: row.suggestions,
  attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
  createdBy: row.created_by,
  createdAt: row.created_at
});
