"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportService = exports.ReportService = void 0;
const ExcelJS = __importStar(require("exceljs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const dataStore_1 = require("../store/dataStore");
const reconciliationService_1 = require("./reconciliationService");
class ReportService {
    async generateReport(batchId, resultId, generatedBy, periodStart, periodEnd) {
        const result = dataStore_1.dataStore.getReconciliationResult(resultId);
        if (!result) {
            throw new Error('Reconciliation result not found');
        }
        const cableCarIds = new Set();
        result.diffs.forEach(d => cableCarIds.add(d.cableCarId));
        const traceability = [];
        for (const cableCarId of cableCarIds) {
            const chain = reconciliationService_1.reconciliationService.getTraceabilityChain(cableCarId, resultId);
            if (chain) {
                traceability.push({
                    cableCarId,
                    maintenanceRecordId: chain.maintenanceRecords[0]?.id,
                    sensorDataId: chain.sensorData[0]?.id,
                    approvalRecordId: chain.approvalRecords.find(a => a.approvalType === 'release')?.id,
                    diffIds: chain.diffs.map(d => d.id),
                    finalStatus: chain.finalStatus,
                });
            }
        }
        return dataStore_1.dataStore.addReport({
            batchId,
            generatedBy,
            period: {
                start: periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: periodEnd || new Date().toISOString().split('T')[0],
            },
            summary: result.summary,
            diffs: result.diffs,
            traceability,
        });
    }
    async generateExcelReport(reportId) {
        const report = dataStore_1.dataStore.getReport(reportId);
        if (!report) {
            throw new Error('Report not found');
        }
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Cable Car Reconciliation System';
        workbook.created = new Date();
        const summarySheet = workbook.addWorksheet('汇总');
        summarySheet.columns = [
            { header: '统计项', key: 'item', width: 30 },
            { header: '数值', key: 'value', width: 20 },
        ];
        summarySheet.addRow({ item: '报告生成时间', value: report.generatedAt });
        summarySheet.addRow({ item: '报告生成人', value: report.generatedBy });
        summarySheet.addRow({ item: '统计周期开始', value: report.period.start });
        summarySheet.addRow({ item: '统计周期结束', value: report.period.end });
        summarySheet.addRow({ item: '差异总数', value: report.summary.totalDiffs });
        summarySheet.addRow({ item: '高严重性', value: report.summary.bySeverity.high });
        summarySheet.addRow({ item: '中严重性', value: report.summary.bySeverity.medium });
        summarySheet.addRow({ item: '低严重性', value: report.summary.bySeverity.low });
        summarySheet.addRow({ item: '试运行问题', value: report.summary.trialRunIssues });
        summarySheet.addRow({ item: '关键项未签字', value: report.summary.unsignedKeyItems });
        summarySheet.addRow({ item: '超期放行', value: report.summary.overdueReleases });
        summarySheet.addRow({ item: '通过率', value: `${report.summary.passRate.toFixed(2)}%` });
        const diffsSheet = workbook.addWorksheet('差异明细');
        diffsSheet.columns = [
            { header: '缆车编号', key: 'cableCarId', width: 15 },
            { header: '差异类型', key: 'type', width: 25 },
            { header: '严重程度', key: 'severity', width: 12 },
            { header: '标题', key: 'title', width: 30 },
            { header: '描述', key: 'description', width: 50 },
            { header: '状态', key: 'status', width: 12 },
            { header: '复核人', key: 'reviewedBy', width: 15 },
            { header: '复核时间', key: 'reviewedAt', width: 25 },
            { header: '复核备注', key: 'reviewNotes', width: 30 },
        ];
        const typeMap = {
            trial_run_insufficient: '试运行不足',
            key_item_unsigned: '关键项未签',
            overdue_release: '超期放行',
            maintenance_fail: '检修不合格',
            sensor_abnormal: '传感器异常',
            approval_missing: '审批缺失',
            approval_pending: '审批待处理',
        };
        for (const diff of report.diffs) {
            diffsSheet.addRow({
                cableCarId: diff.cableCarId,
                type: typeMap[diff.type] || diff.type,
                severity: diff.severity === 'high' ? '高' : diff.severity === 'medium' ? '中' : '低',
                title: diff.title,
                description: diff.description,
                status: diff.status === 'open' ? '待处理' : diff.status === 'confirmed' ? '已确认' : '已解决',
                reviewedBy: diff.reviewedBy || '',
                reviewedAt: diff.reviewedAt || '',
                reviewNotes: diff.reviewNotes || '',
            });
        }
        const traceSheet = workbook.addWorksheet('追溯链路');
        traceSheet.columns = [
            { header: '缆车编号', key: 'cableCarId', width: 15 },
            { header: '最终状态', key: 'finalStatus', width: 12 },
            { header: '检修记录ID', key: 'maintenanceId', width: 40 },
            { header: '传感器数据ID', key: 'sensorId', width: 40 },
            { header: '审批记录ID', key: 'approvalId', width: 40 },
            { header: '关联差异数', key: 'diffCount', width: 12 },
        ];
        for (const trace of report.traceability) {
            traceSheet.addRow({
                cableCarId: trace.cableCarId,
                finalStatus: trace.finalStatus === 'pass' ? '通过' : trace.finalStatus === 'warning' ? '警告' : '未通过',
                maintenanceId: trace.maintenanceRecordId || '',
                sensorId: trace.sensorDataId || '',
                approvalId: trace.approvalRecordId || '',
                diffCount: trace.diffIds.length,
            });
        }
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
    async generatePdfReport(reportId) {
        const report = dataStore_1.dataStore.getReport(reportId);
        if (!report) {
            throw new Error('Report not found');
        }
        return new Promise((resolve, reject) => {
            const doc = new pdfkit_1.default();
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            doc.fontSize(20).text('景区缆车检修放行对账报告', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`生成时间: ${report.generatedAt}`);
            doc.text(`生成人: ${report.generatedBy}`);
            doc.text(`统计周期: ${report.period.start} 至 ${report.period.end}`);
            doc.moveDown();
            doc.fontSize(16).text('汇总统计', { underline: true });
            doc.moveDown();
            doc.fontSize(12);
            doc.text(`差异总数: ${report.summary.totalDiffs}`);
            doc.text(`高严重性: ${report.summary.bySeverity.high}`);
            doc.text(`中严重性: ${report.summary.bySeverity.medium}`);
            doc.text(`低严重性: ${report.summary.bySeverity.low}`);
            doc.text(`试运行问题: ${report.summary.trialRunIssues}`);
            doc.text(`关键项未签字: ${report.summary.unsignedKeyItems}`);
            doc.text(`超期放行: ${report.summary.overdueReleases}`);
            doc.text(`通过率: ${report.summary.passRate.toFixed(2)}%`);
            doc.moveDown();
            doc.fontSize(16).text('差异明细', { underline: true });
            doc.moveDown();
            const typeMap = {
                trial_run_insufficient: '试运行不足',
                key_item_unsigned: '关键项未签',
                overdue_release: '超期放行',
                maintenance_fail: '检修不合格',
                sensor_abnormal: '传感器异常',
                approval_missing: '审批缺失',
                approval_pending: '审批待处理',
            };
            for (const diff of report.diffs) {
                doc.fontSize(10);
                doc.text(`缆车: ${diff.cableCarId}`, { continued: true });
                doc.text(` | 类型: ${typeMap[diff.type] || diff.type}`, { continued: true });
                doc.text(` | 严重: ${diff.severity === 'high' ? '高' : diff.severity === 'medium' ? '中' : '低'}`);
                doc.text(`标题: ${diff.title}`);
                doc.text(`描述: ${diff.description}`);
                doc.text(`状态: ${diff.status === 'open' ? '待处理' : diff.status === 'confirmed' ? '已确认' : '已解决'}`);
                if (diff.reviewedBy) {
                    doc.text(`复核人: ${diff.reviewedBy} | 复核时间: ${diff.reviewedAt}`);
                }
                doc.moveDown(0.5);
            }
            doc.end();
        });
    }
    getReport(reportId) {
        return dataStore_1.dataStore.getReport(reportId);
    }
    getAllReports() {
        return dataStore_1.dataStore.getAllReports();
    }
}
exports.ReportService = ReportService;
exports.reportService = new ReportService();
//# sourceMappingURL=reportService.js.map