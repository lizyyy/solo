"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionService = void 0;
const SubmissionDAO_1 = require("../models/SubmissionDAO");
const HistoryRecordDAO_1 = require("../models/HistoryRecordDAO");
const RuleVersionDAO_1 = require("../models/RuleVersionDAO");
const RuleEngineService_1 = require("./RuleEngineService");
const types_1 = require("../models/types");
class SubmissionService {
    static createSubmission(request, createdBy) {
        const activeRule = RuleVersionDAO_1.RuleVersionDAO.getActiveRule();
        if (!activeRule) {
            throw new Error('没有可用的审核规则');
        }
        const now = new Date();
        const validDays = activeRule.rules.attachmentValidDays;
        const expireDate = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);
        const attachments = request.attachments.map((att, idx) => ({
            id: `att-${Date.now()}-${idx}`,
            name: att.name,
            type: att.type,
            size: att.size,
            uploadedAt: now,
            expireAt: expireDate,
            isExpired: false
        }));
        const submission = SubmissionDAO_1.SubmissionDAO.create({
            batchId: request.batchId,
            studentId: request.studentId,
            studentName: request.studentName,
            courseCode: request.courseCode,
            courseName: request.courseName,
            content: request.content,
            attachments,
            ruleVersionId: activeRule.id,
            status: types_1.SubmissionStatus.PENDING
        });
        HistoryRecordDAO_1.HistoryRecordDAO.create({
            submissionId: submission.id,
            fieldName: 'status',
            oldValue: undefined,
            newValue: types_1.SubmissionStatus.PENDING,
            changeReason: '创建提交',
            sourceSystem: 'web',
            changedBy: createdBy
        });
        return submission;
    }
    static createSubmissionWithExpiredAttachment(request, createdBy) {
        const activeRule = RuleVersionDAO_1.RuleVersionDAO.getActiveRule();
        if (!activeRule) {
            throw new Error('没有可用的审核规则');
        }
        const now = new Date();
        const expireDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const attachments = request.attachments.map((att, idx) => ({
            id: `att-${Date.now()}-${idx}`,
            name: att.name,
            type: att.type,
            size: att.size,
            uploadedAt: now,
            expireAt: expireDate,
            isExpired: true
        }));
        const submission = SubmissionDAO_1.SubmissionDAO.create({
            batchId: request.batchId,
            studentId: request.studentId,
            studentName: request.studentName,
            courseCode: request.courseCode,
            courseName: request.courseName,
            content: request.content,
            attachments,
            ruleVersionId: activeRule.id,
            status: types_1.SubmissionStatus.PENDING
        });
        HistoryRecordDAO_1.HistoryRecordDAO.create({
            submissionId: submission.id,
            fieldName: 'status',
            oldValue: undefined,
            newValue: types_1.SubmissionStatus.PENDING,
            changeReason: '创建测试提交（含过期附件）',
            sourceSystem: 'test',
            changedBy: createdBy
        });
        return submission;
    }
    static async processSubmission(submissionId, processedBy) {
        const submission = SubmissionDAO_1.SubmissionDAO.getById(submissionId);
        if (!submission) {
            throw new Error('提交不存在');
        }
        const startTime = Date.now();
        const result = await RuleEngineService_1.RuleEngineService.validateSubmission(submission);
        const processingTime = Date.now() - startTime;
        const updatedSubmission = SubmissionDAO_1.SubmissionDAO.update(submissionId, {
            status: result.status,
            summary: result.summary,
            conclusion: result.conclusion,
            processingTime,
            processedAt: new Date()
        });
        HistoryRecordDAO_1.HistoryRecordDAO.create({
            submissionId,
            fieldName: 'status',
            oldValue: submission.status,
            newValue: result.status,
            changeReason: result.conclusion,
            sourceSystem: 'rule-engine',
            changedBy: processedBy
        });
        return updatedSubmission;
    }
    static async processBatch(batchId, processedBy) {
        const submissions = SubmissionDAO_1.SubmissionDAO.getByBatchId(batchId);
        const pendingSubmissions = submissions.filter(s => s.status === types_1.SubmissionStatus.PENDING);
        for (const submission of pendingSubmissions) {
            await this.processSubmission(submission.id, processedBy);
        }
        return pendingSubmissions.length;
    }
    static previewBatchAction(batchId, actionType) {
        const submissions = SubmissionDAO_1.SubmissionDAO.getByBatchId(batchId);
        let affectedSubmissions;
        switch (actionType) {
            case types_1.BatchActionType.APPROVE:
                affectedSubmissions = submissions.filter(s => s.status === types_1.SubmissionStatus.PENDING || s.status === types_1.SubmissionStatus.REJECTED);
                break;
            case types_1.BatchActionType.REJECT:
                affectedSubmissions = submissions.filter(s => s.status === types_1.SubmissionStatus.PENDING);
                break;
            case types_1.BatchActionType.REPROCESS:
                affectedSubmissions = submissions;
                break;
            default:
                affectedSubmissions = [];
        }
        const warnings = [];
        const hasExpired = affectedSubmissions.some(s => s.attachments.some(a => a.isExpired));
        if (hasExpired) {
            warnings.push('部分提交包含过期附件，处理后将被标记为附件过期');
        }
        const estimatedTime = affectedSubmissions.length * 50;
        return {
            actionType,
            affectedCount: affectedSubmissions.length,
            affectedIds: affectedSubmissions.map(s => s.id),
            sampleSubmissions: affectedSubmissions.slice(0, 5),
            estimatedTime,
            warnings
        };
    }
    static updateSubmissionField(submissionId, fieldName, oldValue, newValue, changeReason, sourceSystem, changedBy) {
        const updateObj = {};
        updateObj[fieldName] = newValue;
        const updated = SubmissionDAO_1.SubmissionDAO.update(submissionId, updateObj);
        if (updated) {
            HistoryRecordDAO_1.HistoryRecordDAO.create({
                submissionId,
                fieldName,
                oldValue,
                newValue,
                changeReason,
                sourceSystem,
                changedBy
            });
        }
        return updated;
    }
    static getSubmissionWithHistory(submissionId) {
        const submission = SubmissionDAO_1.SubmissionDAO.getById(submissionId);
        const history = submission ? HistoryRecordDAO_1.HistoryRecordDAO.getBySubmissionId(submissionId) : [];
        return { submission, history };
    }
    static getBatchStats(batchId) {
        return SubmissionDAO_1.SubmissionDAO.getStats(batchId);
    }
    static getAllBatches() {
        return SubmissionDAO_1.SubmissionDAO.getDistinctBatchIds();
    }
}
exports.SubmissionService = SubmissionService;
//# sourceMappingURL=SubmissionService.js.map