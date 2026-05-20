"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ApplicationService_1 = __importDefault(require("../services/ApplicationService"));
const dayjs_1 = __importDefault(require("dayjs"));
const request_1 = require("../utils/request");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const page = (0, request_1.getQueryNumber)(req.query.page) || 1;
        const pageSize = (0, request_1.getQueryNumber)(req.query.pageSize) || 20;
        const status = (0, request_1.getQueryString)(req.query.status);
        const merchantName = (0, request_1.getQueryString)(req.query.merchantName);
        const stallLocation = (0, request_1.getQueryString)(req.query.stallLocation);
        const certificateVersion = (0, request_1.getQueryString)(req.query.certificateVersion);
        const startDateStr = (0, request_1.getQueryString)(req.query.startDate);
        const endDateStr = (0, request_1.getQueryString)(req.query.endDate);
        const startDate = startDateStr ? (0, dayjs_1.default)(startDateStr).toDate() : undefined;
        const endDate = endDateStr ? (0, dayjs_1.default)(endDateStr).toDate() : undefined;
        const result = await ApplicationService_1.default.listApplications(page, pageSize, {
            status,
            merchantName,
            stallLocation,
            startDate,
            endDate,
            certificateVersion,
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const application = await ApplicationService_1.default.getApplicationById(parseInt((0, request_1.getParamString)(req.params.id)));
        if (!application) {
            return res.status(404).json({ error: '申请记录不存在' });
        }
        res.json(application);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/:id/approve', async (req, res) => {
    try {
        const { operator, reason, venueName } = req.body;
        if (!operator) {
            return res.status(400).json({ error: '操作人不能为空' });
        }
        const result = await ApplicationService_1.default.approveApplication(parseInt((0, request_1.getParamString)(req.params.id)), operator, reason, venueName);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/:id/reject', async (req, res) => {
    try {
        const { operator, reason } = req.body;
        if (!operator) {
            return res.status(400).json({ error: '操作人不能为空' });
        }
        const result = await ApplicationService_1.default.rejectApplication(parseInt((0, request_1.getParamString)(req.params.id)), operator, reason);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/:id/return', async (req, res) => {
    try {
        const { operator, reason } = req.body;
        if (!operator) {
            return res.status(400).json({ error: '操作人不能为空' });
        }
        const result = await ApplicationService_1.default.returnForModify(parseInt((0, request_1.getParamString)(req.params.id)), operator, reason);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/:id/logs', async (req, res) => {
    try {
        const logs = await ApplicationService_1.default.getLogsByApplication(parseInt((0, request_1.getParamString)(req.params.id)));
        res.json(logs);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
