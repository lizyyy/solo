"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportController = void 0;
const joi_1 = __importDefault(require("joi"));
const export_service_1 = require("../services/export.service");
const createRequestSchema = joi_1.default.object({
    topicId: joi_1.default.string().required(),
    startTime: joi_1.default.string().isoDate().required(),
    endTime: joi_1.default.string().isoDate().required(),
    requester: joi_1.default.string().required(),
    reason: joi_1.default.string().required(),
    idempotencyKey: joi_1.default.string().optional()
});
const approveSchema = joi_1.default.object({
    approver: joi_1.default.string().required(),
    comment: joi_1.default.string().optional()
});
const rejectSchema = joi_1.default.object({
    approver: joi_1.default.string().required(),
    reason: joi_1.default.string().required()
});
const verifySchema = joi_1.default.object({
    verifier: joi_1.default.string().required()
});
const reportSchema = joi_1.default.object({
    generator: joi_1.default.string().required(),
    format: joi_1.default.string().valid("json", "csv").default("json")
});
const correctionSchema = joi_1.default.object({
    corrector: joi_1.default.string().required(),
    correctionType: joi_1.default.string().required(),
    originalValue: joi_1.default.object().required(),
    correctedValue: joi_1.default.object().required(),
    reason: joi_1.default.string().required()
});
const handleFailureSchema = joi_1.default.object({
    handler: joi_1.default.string().required(),
    errorMessage: joi_1.default.string().required(),
    processingEvidence: joi_1.default.object().required()
});
class ExportController {
    static async createRequest(req, res) {
        try {
            const { error, value } = createRequestSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }
            const result = await export_service_1.ExportService.createExportRequest(value.topicId, value.startTime, value.endTime, value.requester, value.reason, value.idempotencyKey);
            res.status(result.isNew ? 201 : 200).json({
                success: true,
                isNew: result.isNew,
                data: result.request
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    static async getRequests(req, res) {
        try {
            const { status, topicId, requester } = req.query;
            const filters = {};
            if (status)
                filters.status = status;
            if (topicId)
                filters.topicId = topicId;
            if (requester)
                filters.requester = requester;
            const requests = await export_service_1.ExportService.getRequests(filters);
            res.json({ success: true, data: requests });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    static async getRequestById(req, res) {
        try {
            const { id } = req.params;
            const request = await export_service_1.ExportService.getRequestById(id);
            if (!request) {
                return res.status(404).json({ error: "Export request not found" });
            }
            res.json({ success: true, data: request });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    static async approveRequest(req, res) {
        try {
            const { id } = req.params;
            const { error, value } = approveSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }
            const result = await export_service_1.ExportService.approveRequest(id, value.approver, value.comment);
            res.json({ success: true, data: result });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    static async rejectRequest(req, res) {
        try {
            const { id } = req.params;
            const { error, value } = rejectSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }
            const result = await export_service_1.ExportService.rejectRequest(id, value.approver, value.reason);
            res.json({ success: true, data: result });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    static async verifyHashChain(req, res) {
        try {
            const { id } = req.params;
            const { error, value } = verifySchema.validate(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }
            const result = await export_service_1.ExportService.verifyHashChain(id, value.verifier);
            res.json({
                success: true,
                data: {
                    verificationId: result.verificationId,
                    isValid: result.isValid,
                    mismatchCount: result.mismatches.length,
                    mismatches: result.mismatches
                }
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    static async generateReport(req, res) {
        try {
            const { id } = req.params;
            const { error, value } = reportSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }
            const result = await export_service_1.ExportService.generateProofReport(id, value.generator, value.format);
            res.json({
                success: true,
                data: {
                    reportId: result.reportId,
                    format: result.format,
                    content: result.reportContent
                }
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    static async exportEvents(req, res) {
        try {
            const { id } = req.params;
            const events = await export_service_1.ExportService.exportEvents(id);
            res.json({
                success: true,
                data: {
                    eventCount: events.length,
                    events
                }
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    static async getProcessingHistory(req, res) {
        try {
            const { id } = req.params;
            const history = await export_service_1.ExportService.getProcessingHistory(id);
            res.json({ success: true, data: history });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    static async addManualCorrection(req, res) {
        try {
            const { id } = req.params;
            const { error, value } = correctionSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }
            const result = await export_service_1.ExportService.addManualCorrection(id, value.corrector, value.correctionType, value.originalValue, value.correctedValue, value.reason);
            res.json({ success: true, data: result });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    static async handleFailure(req, res) {
        try {
            const { id } = req.params;
            const { error, value } = handleFailureSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }
            const result = await export_service_1.ExportService.handleFailure(id, value.handler, new Error(value.errorMessage), value.processingEvidence);
            res.json({ success: true, data: result });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}
exports.ExportController = ExportController;
