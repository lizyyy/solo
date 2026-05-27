"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeductionEvidence = exports.exportSummaryToExcel = exports.exportDetailedToExcel = exports.getSummaryReport = exports.getDetailedReport = void 0;
const reportService_1 = require("../services/reportService");
const dayjs_1 = __importDefault(require("dayjs"));
const getDetailedReport = (req, res) => {
    try {
        const { orderNo } = req.params;
        const report = reportService_1.reportService.generateDetailedReport(orderNo);
        res.json(report);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getDetailedReport = getDetailedReport;
const getSummaryReport = (_req, res) => {
    try {
        const report = reportService_1.reportService.generateSummaryReport();
        res.json(report);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getSummaryReport = getSummaryReport;
const exportDetailedToExcel = (req, res) => {
    try {
        const { orderNo } = req.params;
        const buffer = reportService_1.reportService.exportToExcel(orderNo);
        const filename = `对账详情_${orderNo}_${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.exportDetailedToExcel = exportDetailedToExcel;
const exportSummaryToExcel = (_req, res) => {
    try {
        const buffer = reportService_1.reportService.exportSummaryToExcel();
        const filename = `对账汇总_${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.exportSummaryToExcel = exportSummaryToExcel;
const getDeductionEvidence = (req, res) => {
    try {
        const { orderNo } = req.params;
        const evidence = reportService_1.reportService.generateDeductionEvidence(orderNo);
        res.json(evidence);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getDeductionEvidence = getDeductionEvidence;
