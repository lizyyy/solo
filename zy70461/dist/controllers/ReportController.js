"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const ReportService_1 = require("../services/ReportService");
class ReportController {
    static async generateBatchReport(req, res) {
        try {
            const { batchId } = req.params;
            const processedBy = req.headers['x-user'] || 'system';
            const report = await ReportService_1.ReportService.generateBatchReport(batchId, processedBy);
            const formattedReport = ReportService_1.ReportService.formatReport(report);
            res.json({
                success: true,
                data: report,
                formatted: formattedReport
            });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getReport(req, res) {
        try {
            const { id } = req.params;
            const report = ReportService_1.ReportService.getReportById(id);
            if (!report) {
                return res.status(404).json({ success: false, error: '报告不存在' });
            }
            const formattedReport = ReportService_1.ReportService.formatReport(report);
            res.json({ success: true, data: report, formatted: formattedReport });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getReportsByBatch(req, res) {
        try {
            const { batchId } = req.params;
            const reports = ReportService_1.ReportService.getReportsByBatchId(batchId);
            res.json({ success: true, data: reports });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getAllReports(req, res) {
        try {
            const reports = ReportService_1.ReportService.getAllReports();
            res.json({ success: true, data: reports });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
}
exports.ReportController = ReportController;
//# sourceMappingURL=ReportController.js.map