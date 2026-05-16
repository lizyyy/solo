"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const types_1 = require("../types");
const FilingService_1 = require("../services/FilingService");
const router = (0, express_1.Router)();
const createFilingSchema = joi_1.default.object({
    serviceName: joi_1.default.string().required(),
    egressAddress: joi_1.default.string().required(),
    openWindow: joi_1.default.object({
        startTime: joi_1.default.string().isoDate().required(),
        endTime: joi_1.default.string().isoDate().required(),
        timezone: joi_1.default.string().optional()
    }).required(),
    purpose: joi_1.default.string().required(),
    closeCondition: joi_1.default.object({
        type: joi_1.default.string().valid('manual', 'auto', 'timeout').required(),
        trigger: joi_1.default.string().optional(),
        reason: joi_1.default.string().optional()
    }).required(),
    creator: joi_1.default.string().required()
});
const advanceStatusSchema = joi_1.default.object({
    targetStatus: joi_1.default.string().valid(...Object.values(types_1.FilingStatus)).required(),
    operator: joi_1.default.string().optional(),
    reason: joi_1.default.string().required()
});
const exceptionSchema = joi_1.default.object({
    step: joi_1.default.string().required(),
    originalInput: joi_1.default.object().required(),
    processingBasis: joi_1.default.string().required(),
    conclusion: joi_1.default.string().required(),
    errorCode: joi_1.default.string().optional(),
    errorMessage: joi_1.default.string().optional(),
    operator: joi_1.default.string().optional()
});
const manualCorrectionSchema = joi_1.default.object({
    field: joi_1.default.string().required(),
    oldValue: joi_1.default.any().required(),
    newValue: joi_1.default.any().required(),
    operator: joi_1.default.string().required(),
    reason: joi_1.default.string().required()
});
const approvalSchema = joi_1.default.object({
    approver: joi_1.default.string().required(),
    reason: joi_1.default.string().optional()
});
const closeSchema = joi_1.default.object({
    closer: joi_1.default.string().required(),
    reason: joi_1.default.string().required()
});
const accessLogSchema = joi_1.default.object({
    sourceIp: joi_1.default.string().required(),
    destination: joi_1.default.string().required(),
    action: joi_1.default.string().required(),
    result: joi_1.default.string().required()
});
router.post('/', async (req, res) => {
    try {
        const { error, value } = createFilingSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const result = await FilingService_1.filingService.createFiling(value);
        res.status(201).json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/', async (req, res) => {
    try {
        const { status, serviceName } = req.query;
        const filters = {};
        if (status)
            filters.status = status;
        if (serviceName)
            filters.serviceName = serviceName;
        const result = await FilingService_1.filingService.listFilings(filters);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const result = await FilingService_1.filingService.getFiling(req.params.id);
        if (!result) {
            return res.status(404).json({ error: '备案记录不存在' });
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/:id/advance-status', async (req, res) => {
    try {
        const { error, value } = advanceStatusSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const result = await FilingService_1.filingService.advanceStatus(req.params.id, value.targetStatus, value.operator, value.reason);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/:id/approve', async (req, res) => {
    try {
        const { error, value } = approvalSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const result = await FilingService_1.filingService.approveFiling(req.params.id, value.approver);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/:id/reject', async (req, res) => {
    try {
        const { error, value } = approvalSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const result = await FilingService_1.filingService.rejectFiling(req.params.id, value.approver, value.reason || '审批拒绝');
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/:id/exceptions', async (req, res) => {
    try {
        const { error, value } = exceptionSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        await FilingService_1.filingService.handleException(req.params.id, value);
        res.status(201).json({ message: '异常记录已保存' });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/:id/exceptions', async (req, res) => {
    try {
        const result = await FilingService_1.filingService.getExceptions(req.params.id);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/:id/manual-correction', async (req, res) => {
    try {
        const { error, value } = manualCorrectionSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const result = await FilingService_1.filingService.manualCorrection(req.params.id, value);
        res.status(200).json({ message: '人工修正已记录', filing: result });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/:id/access-logs', async (req, res) => {
    try {
        const { error, value } = accessLogSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const result = await FilingService_1.filingService.recordAccess(req.params.id, value.sourceIp, value.destination, value.action, value.result);
        res.status(201).json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/:id/access-logs', async (req, res) => {
    try {
        const result = await FilingService_1.filingService.getAccessLogs(req.params.id);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/:id/close', async (req, res) => {
    try {
        const { error, value } = closeSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        await FilingService_1.filingService.closeFiling(req.params.id, value.closer, value.reason);
        res.json({ message: '备案已关闭' });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/:id/report', async (req, res) => {
    try {
        const result = await FilingService_1.filingService.generateReport(req.params.id);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/:id/export', async (req, res) => {
    try {
        const csv = await FilingService_1.filingService.exportToCSV(req.params.id);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="filing-${req.params.id}.csv"`);
        res.send(csv);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/check-expired', async (req, res) => {
    try {
        const expiredIds = await FilingService_1.filingService.checkExpiredWindows();
        res.json({ expiredIds, count: expiredIds.length });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
