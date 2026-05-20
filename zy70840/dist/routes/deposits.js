"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DepositService_1 = __importDefault(require("../services/DepositService"));
const dayjs_1 = __importDefault(require("dayjs"));
const request_1 = require("../utils/request");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const page = (0, request_1.getQueryNumber)(req.query.page) || 1;
        const pageSize = (0, request_1.getQueryNumber)(req.query.pageSize) || 20;
        const applicationId = (0, request_1.getQueryNumber)(req.query.applicationId);
        const flowType = (0, request_1.getQueryString)(req.query.flowType);
        const operator = (0, request_1.getQueryString)(req.query.operator);
        const startDateStr = (0, request_1.getQueryString)(req.query.startDate);
        const endDateStr = (0, request_1.getQueryString)(req.query.endDate);
        const startDate = startDateStr ? (0, dayjs_1.default)(startDateStr).toDate() : undefined;
        const endDate = endDateStr ? (0, dayjs_1.default)(endDateStr).toDate() : undefined;
        const result = await DepositService_1.default.listFlows(page, pageSize, {
            applicationId,
            flowType,
            operator,
            startDate,
            endDate,
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/application/:applicationId', async (req, res) => {
    try {
        const applicationIdParam = Array.isArray(req.params.applicationId) ? req.params.applicationId[0] : req.params.applicationId;
        const flows = await DepositService_1.default.getFlowsByApplication(parseInt(applicationIdParam));
        res.json(flows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/deduct', async (req, res) => {
    try {
        const { applicationId, amount, reason, operator } = req.body;
        if (!applicationId || !amount || !operator) {
            return res.status(400).json({ error: '必填字段不能为空' });
        }
        const result = await DepositService_1.default.deductDeposit(applicationId, parseFloat(amount), reason, operator);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/collect', async (req, res) => {
    try {
        const { applicationId, amount, reason, operator } = req.body;
        if (!applicationId || !amount || !operator) {
            return res.status(400).json({ error: '必填字段不能为空' });
        }
        const result = await DepositService_1.default.collectDeposit(applicationId, parseFloat(amount), reason, operator);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/refund', async (req, res) => {
    try {
        const { applicationId, reason, operator } = req.body;
        if (!applicationId || !operator) {
            return res.status(400).json({ error: '必填字段不能为空' });
        }
        const result = await DepositService_1.default.refundDeposit(applicationId, reason, operator);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/balance/:applicationId', async (req, res) => {
    try {
        const applicationIdParam = Array.isArray(req.params.applicationId) ? req.params.applicationId[0] : req.params.applicationId;
        const balance = await DepositService_1.default.getCurrentBalance(parseInt(applicationIdParam));
        res.json({ balance });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
