"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correctionController = exports.CorrectionController = void 0;
const CorrectionService_1 = require("../services/CorrectionService");
const ReportService_1 = require("../services/ReportService");
class CorrectionController {
    async createCorrection(req, res) {
        try {
            const result = await CorrectionService_1.correctionService.createCorrection(req.body);
            res.status(201).json({
                success: true,
                message: '修正申请创建成功',
                data: {
                    id: result.id,
                    status: result.status,
                    title: result.title
                }
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '创建失败'
            });
        }
    }
    async getCorrection(req, res) {
        try {
            const id = req.params.id;
            const result = await CorrectionService_1.correctionService.getCorrection(id);
            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: '修正申请不存在'
                });
            }
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '查询失败'
            });
        }
    }
    async listCorrections(req, res) {
        try {
            const { status, applicant, department } = req.query;
            const filters = {
                status: status,
                applicant: applicant,
                department: department
            };
            const results = await CorrectionService_1.correctionService.listCorrections(filters);
            res.json({
                success: true,
                data: results,
                total: results.length
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '查询失败'
            });
        }
    }
    async generatePreview(req, res) {
        try {
            const id = req.params.id;
            const result = await CorrectionService_1.correctionService.generatePreview(id);
            res.json({
                success: true,
                message: '预览生成成功，请确认标签差异和成本影响后提交审批',
                data: result
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '预览生成失败'
            });
        }
    }
    async submitForApproval(req, res) {
        try {
            const id = req.params.id;
            const { approver } = req.body;
            const result = await CorrectionService_1.correctionService.submitForApproval(id, approver);
            res.json({
                success: true,
                message: '已提交审批，请等待审批人处理',
                data: {
                    id: result.id,
                    status: result.status,
                    approver: result.approver
                }
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '提交失败'
            });
        }
    }
    async approveCorrection(req, res) {
        try {
            const id = req.params.id;
            const { approver, comment } = req.body;
            const result = await CorrectionService_1.correctionService.approveCorrection(id, approver, comment);
            res.json({
                success: true,
                message: '审批通过，系统将自动执行标签修正',
                data: {
                    id: result.id,
                    status: result.status
                }
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '审批失败'
            });
        }
    }
    async rejectCorrection(req, res) {
        try {
            const id = req.params.id;
            const { approver, comment } = req.body;
            const result = await CorrectionService_1.correctionService.rejectCorrection(id, approver, comment);
            res.json({
                success: true,
                message: '已驳回申请，请根据审批意见调整后重新提交',
                data: {
                    id: result.id,
                    status: result.status
                }
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '驳回失败'
            });
        }
    }
    async executeCorrection(req, res) {
        try {
            const id = req.params.id;
            const { operator } = req.body;
            const result = await CorrectionService_1.correctionService.executeCorrection(id, operator);
            res.json({
                success: true,
                message: result.status === 'COMPLETED'
                    ? '标签修正执行完成'
                    : '执行过程中出现异常，请查看异常记录',
                data: {
                    id: result.id,
                    status: result.status
                }
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '执行失败'
            });
        }
    }
    async rollbackCorrection(req, res) {
        try {
            const id = req.params.id;
            const { operator } = req.body;
            const result = await CorrectionService_1.correctionService.rollbackCorrection(id, operator);
            res.json({
                success: true,
                message: '已回滚到修正前的标签状态',
                data: {
                    id: result.id,
                    status: result.status
                }
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '回滚失败'
            });
        }
    }
    async manualFix(req, res) {
        try {
            const id = req.params.id;
            const assetId = req.params.assetId;
            const { correctedTags, operator, reason } = req.body;
            const result = await CorrectionService_1.correctionService.manualFix(id, assetId, correctedTags, operator, reason);
            res.json({
                success: true,
                message: '人工修正已记录，请重新预览后继续流程',
                data: {
                    id: result.id,
                    assetId
                }
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '人工修正失败'
            });
        }
    }
    async resolveException(req, res) {
        try {
            const exceptionId = req.params.exceptionId;
            const { resolver, resolution } = req.body;
            const result = await CorrectionService_1.correctionService.resolveException(exceptionId, resolver, resolution);
            res.json({
                success: true,
                message: '异常已标记为解决',
                data: result
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '处理失败'
            });
        }
    }
    async generateReport(req, res) {
        try {
            const id = req.params.id;
            const { generatedBy } = req.body;
            const result = await ReportService_1.reportService.generateReport(id, generatedBy);
            res.json({
                success: true,
                message: '报告生成成功',
                data: {
                    reportId: result.id,
                    summary: result.summary
                }
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '报告生成失败'
            });
        }
    }
    async exportReport(req, res) {
        try {
            const reportId = req.params.reportId;
            const format = req.query.format || 'markdown';
            const report = await ReportService_1.reportService.getReport(reportId);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: '报告不存在'
                });
            }
            if (format === 'csv') {
                const csv = await ReportService_1.reportService.exportToCSV(report);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="correction-report-${reportId}.csv"`);
                res.send('\uFEFF' + csv);
            }
            else {
                const markdown = await ReportService_1.reportService.exportToMarkdown(report);
                res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="correction-report-${reportId}.md"`);
                res.send(markdown);
            }
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '导出失败'
            });
        }
    }
    async getReport(req, res) {
        try {
            const reportId = req.params.reportId;
            const result = await ReportService_1.reportService.getReport(reportId);
            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: '报告不存在'
                });
            }
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '查询失败'
            });
        }
    }
}
exports.CorrectionController = CorrectionController;
exports.correctionController = new CorrectionController();
//# sourceMappingURL=CorrectionController.js.map