"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const billingCalculatorService_1 = require("../services/billingCalculatorService");
const dataStore_1 = require("../store/dataStore");
const moment_1 = __importDefault(require("moment"));
const router = (0, express_1.Router)();
router.post('/calculate', async (req, res) => {
    try {
        const { periodStart, periodEnd } = req.body;
        if (!periodStart || !periodEnd) {
            return res.status(400).json({ success: false, error: '请提供计费周期参数' });
        }
        const start = (0, moment_1.default)(periodStart).toDate();
        const end = (0, moment_1.default)(periodEnd).toDate();
        const records = await billingCalculatorService_1.billingCalculatorService.calculateBillingForPeriod(start, end);
        const summary = billingCalculatorService_1.billingCalculatorService.getBillingSummary(start, end);
        res.json({
            success: true,
            recordsGenerated: records.length,
            records,
            summary
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/records', async (req, res) => {
    try {
        const { periodStart, periodEnd, tenantId, status, page = '1', pageSize = '20' } = req.query;
        let records = dataStore_1.dataStore.getAllBillingRecords();
        if (periodStart && periodEnd) {
            const start = (0, moment_1.default)(periodStart).toDate();
            const end = (0, moment_1.default)(periodEnd).toDate();
            records = records.filter(r => r.periodStart >= start && r.periodEnd <= end);
        }
        if (tenantId) {
            records = records.filter(r => r.tenantId === tenantId);
        }
        if (status) {
            records = records.filter(r => r.reviewStatus === status);
        }
        const pageNum = parseInt(page);
        const size = parseInt(pageSize);
        const total = records.length;
        const paginated = records.slice((pageNum - 1) * size, pageNum * size);
        res.json({
            success: true,
            data: {
                records: paginated,
                total,
                page: pageNum,
                pageSize: size
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/records/:id', async (req, res) => {
    try {
        const record = dataStore_1.dataStore.getBillingRecord(req.params.id);
        if (!record) {
            return res.status(404).json({ success: false, error: '账单记录不存在' });
        }
        res.json({ success: true, data: record });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/records/:id/recalculate', async (req, res) => {
    try {
        const updated = await billingCalculatorService_1.billingCalculatorService.recalculateRecord(req.params.id);
        if (!updated) {
            return res.status(404).json({ success: false, error: '账单记录不存在' });
        }
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/summary', async (req, res) => {
    try {
        const { periodStart, periodEnd } = req.query;
        if (!periodStart || !periodEnd) {
            return res.status(400).json({ success: false, error: '请提供计费周期参数' });
        }
        const summary = billingCalculatorService_1.billingCalculatorService.getBillingSummary((0, moment_1.default)(periodStart).toDate(), (0, moment_1.default)(periodEnd).toDate());
        res.json({ success: true, data: summary });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=billingRoutes.js.map