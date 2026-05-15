"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionController = void 0;
const SubmissionService_1 = require("../services/SubmissionService");
const SubmissionDAO_1 = require("../models/SubmissionDAO");
class SubmissionController {
    static createSubmission(req, res) {
        try {
            const { batchId, studentId, studentName, courseCode, courseName, content, attachments } = req.body;
            const createdBy = req.headers['x-user'] || 'system';
            const submission = SubmissionService_1.SubmissionService.createSubmission({
                batchId, studentId, studentName, courseCode, courseName, content, attachments
            }, createdBy);
            res.status(201).json({ success: true, data: submission });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getSubmission(req, res) {
        try {
            const { id } = req.params;
            const { withHistory } = req.query;
            if (withHistory === 'true') {
                const result = SubmissionService_1.SubmissionService.getSubmissionWithHistory(id);
                if (!result.submission) {
                    return res.status(404).json({ success: false, error: '提交不存在' });
                }
                return res.json({ success: true, data: result.submission, history: result.history });
            }
            const submission = SubmissionDAO_1.SubmissionDAO.getById(id);
            if (!submission) {
                return res.status(404).json({ success: false, error: '提交不存在' });
            }
            res.json({ success: true, data: submission });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getSubmissions(req, res) {
        try {
            const { batchId, status } = req.query;
            let submissions;
            if (batchId) {
                submissions = SubmissionDAO_1.SubmissionDAO.getByBatchId(batchId);
            }
            else if (status) {
                submissions = SubmissionDAO_1.SubmissionDAO.getByStatus(status);
            }
            else {
                submissions = SubmissionDAO_1.SubmissionDAO.getAll();
            }
            res.json({ success: true, data: submissions });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static async processSubmission(req, res) {
        try {
            const { id } = req.params;
            const processedBy = req.headers['x-user'] || 'system';
            const submission = await SubmissionService_1.SubmissionService.processSubmission(id, processedBy);
            res.json({ success: true, data: submission });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static previewBatchAction(req, res) {
        try {
            const { batchId, actionType } = req.params;
            const preview = SubmissionService_1.SubmissionService.previewBatchAction(batchId, actionType);
            res.json({ success: true, data: preview });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static async processBatch(req, res) {
        try {
            const { batchId } = req.params;
            const processedBy = req.headers['x-user'] || 'system';
            const count = await SubmissionService_1.SubmissionService.processBatch(batchId, processedBy);
            const stats = SubmissionService_1.SubmissionService.getBatchStats(batchId);
            res.json({ success: true, data: { processedCount: count, stats } });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static updateSubmissionField(req, res) {
        try {
            const { id } = req.params;
            const { fieldName, oldValue, newValue, changeReason, sourceSystem } = req.body;
            const changedBy = req.headers['x-user'] || 'system';
            const submission = SubmissionService_1.SubmissionService.updateSubmissionField(id, fieldName, oldValue, newValue, changeReason, sourceSystem, changedBy);
            if (!submission) {
                return res.status(404).json({ success: false, error: '提交不存在' });
            }
            res.json({ success: true, data: submission });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getBatchStats(req, res) {
        try {
            const { batchId } = req.params;
            const stats = SubmissionService_1.SubmissionService.getBatchStats(batchId);
            res.json({ success: true, data: stats });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getAllBatches(req, res) {
        try {
            const batches = SubmissionService_1.SubmissionService.getAllBatches();
            res.json({ success: true, data: batches });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
}
exports.SubmissionController = SubmissionController;
//# sourceMappingURL=SubmissionController.js.map