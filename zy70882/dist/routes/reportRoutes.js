"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reportService_1 = require("../services/reportService");
const dataStore_1 = require("../store/dataStore");
const moment_1 = __importDefault(require("moment"));
const router = (0, express_1.Router)();
router.get('/excel', async (req, res) => {
    try {
        const { periodStart, periodEnd, includeDetails = 'true' } = req.query;
        if (!periodStart || !periodEnd) {
            return res.status(400).json({ success: false, error: '请提供计费周期参数' });
        }
        const buffer = await reportService_1.reportService.generateExcelReport((0, moment_1.default)(periodStart).toDate(), (0, moment_1.default)(periodEnd).toDate(), includeDetails === 'true');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=billing-report-${periodStart}-${periodEnd}.xlsx`);
        res.send(buffer);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/pdf', async (req, res) => {
    try {
        const { periodStart, periodEnd, includeDetails = 'true' } = req.query;
        if (!periodStart || !periodEnd) {
            return res.status(400).json({ success: false, error: '请提供计费周期参数' });
        }
        const buffer = await reportService_1.reportService.generatePDFReport((0, moment_1.default)(periodStart).toDate(), (0, moment_1.default)(periodEnd).toDate(), includeDetails === 'true');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=billing-report-${periodStart}-${periodEnd}.pdf`);
        res.send(buffer);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/records/:id/html', async (req, res) => {
    try {
        const record = dataStore_1.dataStore.getBillingRecord(req.params.id);
        if (!record) {
            return res.status(404).json({ success: false, error: '账单记录不存在' });
        }
        const html = reportService_1.reportService.generateRecordDetailsHTML(record);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
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
        const summary = dataStore_1.dataStore.getBillingSummary((0, moment_1.default)(periodStart).toDate(), (0, moment_1.default)(periodEnd).toDate());
        res.json({ success: true, data: summary });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=reportRoutes.js.map