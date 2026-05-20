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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const json2csv_1 = require("json2csv");
const types_1 = require("./types");
class ReportService {
    generateReport(batchCode, records, summary, discrepancies) {
        return {
            reportId: (0, types_1.generateId)(),
            generatedAt: new Date().toISOString(),
            batchCode,
            summary,
            records,
            discrepancies
        };
    }
    exportToJSON(report, outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    }
    exportRecordsToCSV(records, outputPath) {
        const fields = [
            { label: '批次代码', value: 'batchCode' },
            { label: '达人姓名', value: 'influencerName' },
            { label: '样品名称', value: 'sampleName' },
            { label: '样品编码', value: 'sampleCode' },
            { label: '原始状态', value: 'originalStatus' },
            { label: '当前状态', value: 'currentStatus' },
            { label: '差异数量', value: (record) => record.discrepancies.length },
            { label: '差异类型', value: (record) => (0, types_1.getAllDiscrepancyTypes)(record) },
            { label: '差异描述', value: (record) => (0, types_1.getAllDiscrepancyDescriptions)(record) },
            { label: '差异来源', value: (record) => record.discrepancies.map(d => d.source).join(' | ') },
            { label: '扣款金额', value: 'deductionAmount' },
            { label: '复核状态', value: 'reviewStatus' },
            { label: '复核人', value: 'reviewer' },
            { label: '复核备注', value: 'reviewNotes' },
            { label: '是否已修改', value: 'isModified' }
        ];
        const json2csvParser = new json2csv_1.Parser({ fields });
        const csv = json2csvParser.parse(records);
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, '\uFEFF' + csv);
    }
    exportSummaryToCSV(summary, outputPath) {
        const data = [{
                '总记录数': summary.totalShipments,
                '按时归还': summary.returnedOnTime,
                '超期未还': summary.overdue,
                '破损': summary.damaged,
                '丢失': summary.lost,
                '总扣款金额': summary.totalDeduction,
                '待复核': summary.pendingReview,
                '已复核': summary.reviewed
            }];
        const json2csvParser = new json2csv_1.Parser();
        const csv = json2csvParser.parse(data);
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, '\uFEFF' + csv);
    }
    exportDiscrepanciesToCSV(discrepancies, outputPath) {
        const fields = [
            { label: '差异ID', value: 'id' },
            { label: '寄送单ID', value: 'shipmentId' },
            { label: '差异类型', value: 'type' },
            { label: '描述', value: 'description' },
            { label: '涉及金额', value: 'amount' },
            { label: '来源', value: 'source' },
            { label: '是否已解决', value: 'isResolved' },
            { label: '解决方案', value: 'resolution' }
        ];
        const json2csvParser = new json2csv_1.Parser({ fields });
        const csv = json2csvParser.parse(discrepancies);
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, '\uFEFF' + csv);
    }
    exportFullReport(report, outputDir) {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = `reconciliation-${report.batchCode}-${timestamp}`;
        const jsonPath = path.join(outputDir, `${baseName}.json`);
        const recordsCsvPath = path.join(outputDir, `${baseName}-records.csv`);
        const summaryCsvPath = path.join(outputDir, `${baseName}-summary.csv`);
        const discrepanciesCsvPath = path.join(outputDir, `${baseName}-discrepancies.csv`);
        this.exportToJSON(report, jsonPath);
        this.exportRecordsToCSV(report.records, recordsCsvPath);
        this.exportSummaryToCSV(report.summary, summaryCsvPath);
        this.exportDiscrepanciesToCSV(report.discrepancies, discrepanciesCsvPath);
        return { jsonPath, recordsCsvPath, summaryCsvPath, discrepanciesCsvPath };
    }
    generateTextSummary(report) {
        const { summary, discrepancies } = report;
        const resolvedCount = discrepancies.filter(d => d.isResolved).length;
        const unresolvedCount = discrepancies.filter(d => !d.isResolved).length;
        return `
========================================
        MCN样品对账报告
========================================
报告编号: ${report.reportId}
生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}
批次代码: ${report.batchCode}

----------------------------------------
            汇总统计
----------------------------------------
总记录数: ${summary.totalShipments}
按时归还: ${summary.returnedOnTime}
超期未还: ${summary.overdue}
破损: ${summary.damaged}
丢失: ${summary.lost}
总扣款金额: ¥${summary.totalDeduction.toFixed(2)}

待复核: ${summary.pendingReview}
已复核: ${summary.reviewed}

----------------------------------------
            差异统计
----------------------------------------
总差异数: ${discrepancies.length}
已解决: ${resolvedCount}
待解决: ${unresolvedCount}

----------------------------------------
        差异详情
----------------------------------------
${discrepancies.map(d => `
[${d.type}]
描述: ${d.description}
金额: ¥${d.amount.toFixed(2)}
来源: ${d.source}
状态: ${d.isResolved ? '已解决' : '待处理'}
${d.resolution ? `解决方案: ${d.resolution}` : ''}
`).join('')}

========================================
            报告结束
========================================
    `.trim();
    }
    exportTextReport(report, outputPath) {
        const text = this.generateTextSummary(report);
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, text);
    }
}
exports.ReportService = ReportService;
