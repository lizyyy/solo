"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrialFeedbackSummary = exports.listTrialFeedbacks = exports.getTrialFeedbacksBySample = exports.getTrialFeedbackById = exports.createTrialFeedback = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
const historyService_1 = require("./historyService");
const sampleService_1 = require("./sampleService");
const createTrialFeedback = (data, operator) => {
    const sample = (0, sampleService_1.getSampleById)(data.sampleId);
    if (sample.status !== 'IN_TRIAL') {
        throw new response_1.AppError('只有试用中的样品才能提交试用反馈', response_1.errorCodes.BAD_REQUEST, 400);
    }
    if (data.overallRating < 1 || data.overallRating > 5) {
        throw new response_1.AppError('综合评分必须在 1-5 之间', response_1.errorCodes.VALIDATION_ERROR, 400);
    }
    if (!data.testItems || data.testItems.length === 0) {
        throw new response_1.AppError('必须至少包含一个测试项', response_1.errorCodes.VALIDATION_ERROR, 400);
    }
    const now = new Date().toISOString();
    const feedback = {
        id: (0, uuid_1.v4)(),
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
    const stmt = database_1.default.prepare(`
    INSERT INTO trial_feedbacks (id, sample_id, sample_no, trial_user, trial_date, trial_period, trial_location, test_items, overall_rating, conclusion, suggestions, attachments, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(feedback.id, feedback.sampleId, feedback.sampleNo, feedback.trialUser, feedback.trialDate, feedback.trialPeriod, feedback.trialLocation, JSON.stringify(feedback.testItems), feedback.overallRating, feedback.conclusion, feedback.suggestions || null, feedback.attachments ? JSON.stringify(feedback.attachments) : null, feedback.createdBy, feedback.createdAt);
    (0, sampleService_1.updateSampleStatus)(data.sampleId, 'PENDING_REVIEW', operator);
    (0, historyService_1.createHistoryRecord)('TRIAL_FEEDBACK', feedback.id, 'CREATE', `提交试用反馈 - 评分: ${feedback.overallRating}`, operator, undefined, feedback);
    return feedback;
};
exports.createTrialFeedback = createTrialFeedback;
const getTrialFeedbackById = (id) => {
    const row = database_1.default.prepare(`SELECT * FROM trial_feedbacks WHERE id = ?`).get(id);
    if (!row) {
        throw new response_1.AppError(`试用反馈 ${id} 不存在`, response_1.errorCodes.NOT_FOUND, 404);
    }
    return mapToTrialFeedback(row);
};
exports.getTrialFeedbackById = getTrialFeedbackById;
const getTrialFeedbacksBySample = (sampleId) => {
    const rows = database_1.default.prepare(`
    SELECT * FROM trial_feedbacks 
    WHERE sample_id = ? 
    ORDER BY created_at DESC
  `).all(sampleId);
    return rows.map(mapToTrialFeedback);
};
exports.getTrialFeedbacksBySample = getTrialFeedbacksBySample;
const listTrialFeedbacks = (params = {}, page = 1, pageSize = 20) => {
    let query = `SELECT * FROM trial_feedbacks WHERE 1=1`;
    const countQuery = `SELECT COUNT(*) as total FROM trial_feedbacks WHERE 1=1`;
    const whereConditions = [];
    const queryParams = [];
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
    const countStmt = database_1.default.prepare(whereConditions.length > 0
        ? `${countQuery} AND ${whereConditions.join(' AND ')}`
        : countQuery);
    const countResult = countStmt.get(...queryParams);
    const total = countResult.total;
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const paginationParams = [...queryParams, pageSize, (page - 1) * pageSize];
    const rows = database_1.default.prepare(query).all(...paginationParams);
    return {
        items: rows.map(mapToTrialFeedback),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
};
exports.listTrialFeedbacks = listTrialFeedbacks;
const getTrialFeedbackSummary = (sampleId) => {
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
    const params = [];
    if (sampleId) {
        query += ' WHERE sample_id = ?';
        params.push(sampleId);
    }
    const result = database_1.default.prepare(query).get(...params);
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
exports.getTrialFeedbackSummary = getTrialFeedbackSummary;
const mapToTrialFeedback = (row) => ({
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
