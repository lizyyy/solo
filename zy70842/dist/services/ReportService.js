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
exports.reportService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const json2csv_1 = require("json2csv");
const pdfkit_1 = __importDefault(require("pdfkit"));
const dayjs_1 = __importDefault(require("dayjs"));
class ReportService {
    constructor() {
        this.reportsDir = path.join(process.cwd(), 'reports');
        this.ensureReportsDirectory();
    }
    ensureReportsDirectory() {
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }
    generateReconciliationCSV(record) {
        const data = {
            申请编号: record.applicationNo,
            商户名称: record.merchantName,
            摊位位置: record.boothLocation,
            开始日期: record.startDate,
            结束日期: record.endDate,
            申请摊位费: record.boothFee,
            申请押金: record.depositAmount,
            实际摊位费: record.actualBoothFee,
            实际押金: record.actualDepositAmount,
            费用扣减: record.deductions.reduce((sum, d) => sum + d.amount, 0),
            总金额: record.totalAmount,
            状态: this.getStatusText(record.status),
            复核人: record.reviewedBy || '',
            复核时间: record.reviewedAt || '',
            差异数量: record.discrepancies.length,
            需要人工复核: record.discrepancies.some(d => d.requiresManualReview) ? '是' : '否'
        };
        const parser = new json2csv_1.Parser();
        const csv = parser.parse([data]);
        const fileName = `对账单_${record.applicationNo}_${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}.csv`;
        const filePath = path.join(this.reportsDir, fileName);
        fs.writeFileSync(filePath, '\ufeff' + csv, 'utf8');
        return filePath;
    }
    generateDetailedCSV(records) {
        const data = records.map(record => ({
            申请编号: record.applicationNo,
            商户名称: record.merchantName,
            摊位位置: record.boothLocation,
            开始日期: record.startDate,
            结束日期: record.endDate,
            申请摊位费: record.boothFee,
            申请押金: record.depositAmount,
            实际摊位费: record.actualBoothFee,
            实际押金: record.actualDepositAmount,
            费用扣减: record.deductions.reduce((sum, d) => sum + d.amount, 0),
            总金额: record.totalAmount,
            状态: this.getStatusText(record.status),
            复核人: record.reviewedBy || '',
            差异数量: record.discrepancies.length,
            证照过期问题: record.discrepancies.filter(d => d.type === 'LICENSE_EXPIRED').length,
            时间冲突问题: record.discrepancies.filter(d => d.type === 'TIME_CONFLICT').length,
            缺失证照问题: record.discrepancies.filter(d => d.type === 'MISSING_DOCUMENT').length,
            费用不匹配问题: record.discrepancies.filter(d => d.type === 'FEE_MISMATCH').length
        }));
        const parser = new json2csv_1.Parser();
        const csv = parser.parse(data);
        const fileName = `对账单汇总_${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}.csv`;
        const filePath = path.join(this.reportsDir, fileName);
        fs.writeFileSync(filePath, '\ufeff' + csv, 'utf8');
        return filePath;
    }
    generateReconciliationPDF(record) {
        const fileName = `对账单_${record.applicationNo}_${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}.pdf`;
        const filePath = path.join(this.reportsDir, fileName);
        const doc = new pdfkit_1.default({ margin: 50 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        doc.fontSize(20).text('快闪摊位对账单', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`生成时间: ${(0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss')}`);
        doc.moveDown();
        doc.fontSize(14).text('一、基本信息', { underline: true });
        doc.moveDown();
        doc.fontSize(12);
        doc.text(`申请编号: ${record.applicationNo}`);
        doc.text(`商户名称: ${record.merchantName}`);
        doc.text(`摊位位置: ${record.boothLocation}`);
        doc.text(`活动周期: ${record.startDate} 至 ${record.endDate}`);
        doc.text(`当前状态: ${this.getStatusText(record.status)}`);
        if (record.reviewedBy) {
            doc.text(`复核人: ${record.reviewedBy}`);
        }
        doc.moveDown();
        doc.fontSize(14).text('二、费用明细', { underline: true });
        doc.moveDown();
        doc.fontSize(12);
        const boothFeeDeductions = record.deductions.filter(d => !d.type.startsWith('押金扣减-'));
        const depositDeductions = record.deductions.filter(d => d.type.startsWith('押金扣减-'));
        doc.text(`申请摊位费: ¥${record.boothFee.toFixed(2)}`);
        if (boothFeeDeductions.length > 0) {
            doc.text('摊位费扣减明细:');
            for (const deduction of boothFeeDeductions) {
                doc.text(`  - ${deduction.type}: ¥${deduction.amount.toFixed(2)}`);
                doc.text(`    原因: ${deduction.reason}`);
            }
        }
        const totalBoothFeeDeductions = boothFeeDeductions.reduce((sum, d) => sum + d.amount, 0);
        if (totalBoothFeeDeductions > 0) {
            doc.text(`摊位费扣减合计: ¥${totalBoothFeeDeductions.toFixed(2)}`);
        }
        doc.text(`实际摊位费: ¥${record.actualBoothFee.toFixed(2)}`);
        doc.moveDown();
        doc.text(`申请押金金额: ¥${record.depositAmount.toFixed(2)}`);
        if (depositDeductions.length > 0) {
            doc.text('押金扣减明细:');
            for (const deduction of depositDeductions) {
                doc.text(`  - ${deduction.type}: ¥${deduction.amount.toFixed(2)}`);
                doc.text(`    原因: ${deduction.reason}`);
            }
        }
        const totalDepositDeductions = depositDeductions.reduce((sum, d) => sum + d.amount, 0);
        if (totalDepositDeductions > 0) {
            doc.text(`押金扣减合计: ¥${totalDepositDeductions.toFixed(2)}`);
        }
        doc.text(`实际应退押金: ¥${record.actualDepositAmount.toFixed(2)}`);
        doc.moveDown();
        const totalDeductions = record.deductions.reduce((sum, d) => sum + d.amount, 0);
        doc.text(`费用扣减总计: ¥${totalDeductions.toFixed(2)}`);
        doc.fontSize(14).text(`应缴总金额: ¥${record.totalAmount.toFixed(2)}`);
        doc.moveDown();
        if (record.discrepancies.length > 0) {
            doc.addPage();
            doc.fontSize(14).text('三、差异说明', { underline: true });
            doc.moveDown();
            for (let i = 0; i < record.discrepancies.length; i++) {
                const disc = record.discrepancies[i];
                doc.fontSize(12);
                doc.text(`${i + 1}. ${disc.description}`);
                doc.text(`   类型: ${this.getDiscrepancyTypeText(disc.type)}`);
                doc.text(`   严重程度: ${this.getSeverityText(disc.severity)}`);
                doc.text(`   状态: ${this.getDiscrepancyStatusText(disc.status)}`);
                if (disc.expectedValue && disc.actualValue) {
                    doc.text(`   期望值: ${disc.expectedValue}`);
                    doc.text(`   实际值: ${disc.actualValue}`);
                }
                if (disc.explanation) {
                    doc.text(`   说明: ${disc.explanation}`);
                }
                doc.moveDown();
            }
        }
        if (record.reviewActions.length > 0) {
            doc.addPage();
            doc.fontSize(14).text('四、复核记录', { underline: true });
            doc.moveDown();
            for (let i = 0; i < record.reviewActions.length; i++) {
                const action = record.reviewActions[i];
                doc.fontSize(12);
                doc.text(`${i + 1}. 复核人: ${action.reviewer}`);
                doc.text(`   复核结果: ${this.getReviewResultText(action.reviewResult)}`);
                doc.text(`   复核意见: ${action.reviewNotes}`);
                if (action.adjustmentAmount !== undefined) {
                    doc.text(`   调整金额: ¥${action.adjustmentAmount.toFixed(2)}`);
                }
                if (action.adjustmentReason) {
                    doc.text(`   调整原因: ${action.adjustmentReason}`);
                }
                doc.text(`   复核时间: ${(0, dayjs_1.default)(action.reviewedAt).format('YYYY-MM-DD HH:mm:ss')}`);
                doc.moveDown();
            }
        }
        doc.end();
        return new Promise((resolve) => {
            stream.on('finish', () => {
                resolve(filePath);
            });
        });
    }
    generateSummaryPDF(summary) {
        const fileName = `对账汇总_${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}.pdf`;
        const filePath = path.join(this.reportsDir, fileName);
        const doc = new pdfkit_1.default({ margin: 50 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        doc.fontSize(20).text('快闪摊位对账汇总报告', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`生成时间: ${(0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss')}`);
        doc.moveDown();
        doc.fontSize(14).text('一、对账统计', { underline: true });
        doc.moveDown();
        doc.fontSize(12);
        doc.text(`对账记录总数: ${summary.totalRecords}`);
        doc.text(`已批准记录: ${summary.approvedRecords}`);
        doc.text(`已拒绝记录: ${summary.rejectedRecords}`);
        doc.text(`待处理记录: ${summary.pendingRecords}`);
        doc.moveDown();
        doc.fontSize(14).text('二、费用汇总', { underline: true });
        doc.moveDown();
        doc.fontSize(12);
        doc.text(`摊位费合计: ¥${summary.totalBoothFee.toFixed(2)}`);
        doc.text(`押金合计: ¥${summary.totalDeposit.toFixed(2)}`);
        doc.text(`费用扣减合计: ¥${summary.totalDeductions.toFixed(2)}`);
        doc.fontSize(14).text(`应收总金额: ¥${summary.netAmount.toFixed(2)}`);
        doc.moveDown();
        doc.fontSize(14).text('三、问题统计', { underline: true });
        doc.moveDown();
        doc.fontSize(12);
        doc.text(`证照过期问题: ${summary.discrepancyCount.licenseExpired}`);
        doc.text(`时间冲突问题: ${summary.discrepancyCount.timeConflict}`);
        doc.text(`押金扣减问题: ${summary.discrepancyCount.depositDeduction}`);
        doc.text(`缺失证照问题: ${summary.discrepancyCount.missingDocument}`);
        doc.text(`费用不匹配问题: ${summary.discrepancyCount.feeMismatch}`);
        doc.text(`人工复核问题: ${summary.discrepancyCount.manualReview}`);
        doc.end();
        return new Promise((resolve) => {
            stream.on('finish', () => {
                resolve(filePath);
            });
        });
    }
    getReportFilePath(fileName) {
        const filePath = path.join(this.reportsDir, fileName);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        return null;
    }
    getStatusText(status) {
        const statusMap = {
            DRAFT: '草稿',
            REVIEWING: '待复核',
            APPROVED: '已批准',
            REJECTED: '已拒绝',
            COMPLETED: '已完成'
        };
        return statusMap[status] || status;
    }
    getDiscrepancyTypeText(type) {
        const typeMap = {
            LICENSE_EXPIRED: '证照过期',
            TIME_CONFLICT: '时间冲突',
            DEPOSIT_DEDUCTION: '押金扣减',
            MISSING_DOCUMENT: '缺失证照',
            FEE_MISMATCH: '费用不匹配',
            MANUAL_REVIEW: '人工复核'
        };
        return typeMap[type] || type;
    }
    getSeverityText(severity) {
        const severityMap = {
            HIGH: '高',
            MEDIUM: '中',
            LOW: '低'
        };
        return severityMap[severity] || severity;
    }
    getDiscrepancyStatusText(status) {
        const statusMap = {
            PENDING: '待处理',
            APPROVED: '已批准',
            REJECTED: '已拒绝',
            DOCUMENTS_REQUESTED: '已要求补材料'
        };
        return statusMap[status] || status;
    }
    getReviewResultText(result) {
        const resultMap = {
            APPROVE: '批准',
            REJECT: '拒绝',
            REQUEST_DOCUMENTS: '要求补材料',
            ADJUST_AND_APPROVE: '调整并批准'
        };
        return resultMap[result] || result;
    }
}
exports.reportService = new ReportService();
