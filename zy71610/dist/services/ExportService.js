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
exports.exportService = exports.ExportService = void 0;
const csv_writer_1 = require("csv-writer");
const XLSX = __importStar(require("xlsx"));
const dayjs_1 = __importDefault(require("dayjs"));
class ExportService {
    flattenApplication(app, options) {
        const result = {
            申请编号: app.applicationNo,
            合同编号: app.contractNo,
            申请人: app.applicant,
            申请日期: (0, dayjs_1.default)(app.applicationDate).format('YYYY-MM-DD HH:mm:ss'),
            状态: app.status,
            '剩余本金(最终)': app.remainingPrincipal.final,
            '剩余服务费(最终)': app.remainingServiceFee.final,
            '可退服务费(最终)': app.refundableServiceFee.final,
            '提前结清违约金(最终)': app.earlySettlementPenalty.final,
            '应还总额(最终)': app.totalPayableAmount.final,
            结清原因: app.settlementReason,
            备注: app.remark || '',
            异常数量: app.anomalies.filter((a) => !a.resolved).length,
            创建人: app.createdBy,
            创建时间: (0, dayjs_1.default)(app.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        };
        if (options.includeOriginal) {
            result['剩余本金(原始)'] = app.remainingPrincipal.original;
            result['剩余服务费(原始)'] = app.remainingServiceFee.original;
            result['可退服务费(原始)'] = app.refundableServiceFee.original;
            result['提前结清违约金(原始)'] = app.earlySettlementPenalty.original;
            result['应还总额(原始)'] = app.totalPayableAmount.original;
        }
        if (options.includeCorrection) {
            result['剩余本金(修正)'] = app.remainingPrincipal.corrected ?? '';
            result['剩余服务费(修正)'] = app.remainingServiceFee.corrected ?? '';
            result['可退服务费(修正)'] = app.refundableServiceFee.corrected ?? '';
            result['提前结清违约金(修正)'] = app.earlySettlementPenalty.corrected ?? '';
            result['应还总额(修正)'] = app.totalPayableAmount.corrected ?? '';
        }
        if (options.includeAnomalies) {
            const unresolvedAnomalies = app.anomalies.filter((a) => !a.resolved);
            result['异常类型'] = unresolvedAnomalies.map((a) => a.type).join('; ');
            result['异常详情'] = unresolvedAnomalies.map((a) => a.message).join('; ');
            result['异常严重程度'] = unresolvedAnomalies
                .map((a) => a.severity)
                .join('; ');
        }
        if (options.includeReasons) {
            result['试算理由'] = app.reasons.trialCalculation
                .map((r) => r.message)
                .join(' | ');
            result['费用冲回理由'] = app.reasons.feeReversal
                .map((r) => r.message)
                .join(' | ');
            result['流水核对理由'] = app.reasons.flowVerification
                .map((r) => r.message)
                .join(' | ');
            result['状态流转理由'] = app.reasons.stateTransition
                .map((r) => r.message)
                .join(' | ');
        }
        return result;
    }
    flattenStatement(statement, options) {
        const result = {
            结清单号: statement.statementNo,
            申请编号: statement.applicationNo,
            合同编号: statement.contractNo,
            '剩余本金(最终)': statement.finalSnapshot.remainingPrincipal,
            '剩余服务费(最终)': statement.finalSnapshot.remainingServiceFee,
            '可退服务费(最终)': statement.finalSnapshot.refundableServiceFee,
            '提前结清违约金(最终)': statement.finalSnapshot.earlySettlementPenalty,
            '应还总额(最终)': statement.finalSnapshot.totalPayableAmount,
            结论: statement.finalSnapshot.conclusion,
            是否已导出: statement.isExported ? '是' : '否',
            导出时间: statement.exportedAt
                ? (0, dayjs_1.default)(statement.exportedAt).format('YYYY-MM-DD HH:mm:ss')
                : '',
            导出人: statement.exportedBy || '',
            创建人: statement.createdBy,
            创建时间: (0, dayjs_1.default)(statement.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        };
        if (options.includeOriginal) {
            result['剩余本金(原始)'] = statement.originalSnapshot.remainingPrincipal;
            result['剩余服务费(原始)'] = statement.originalSnapshot.remainingServiceFee;
            result['可退服务费(原始)'] = statement.originalSnapshot.refundableServiceFee;
            result['提前结清违约金(原始)'] = statement.originalSnapshot.earlySettlementPenalty;
            result['应还总额(原始)'] = statement.originalSnapshot.totalPayableAmount;
        }
        if (options.includeCorrection && statement.correctionSnapshot) {
            result['剩余本金(修正)'] = statement.correctionSnapshot.remainingPrincipal ?? '';
            result['剩余服务费(修正)'] = statement.correctionSnapshot.remainingServiceFee ?? '';
            result['可退服务费(修正)'] = statement.correctionSnapshot.refundableServiceFee ?? '';
            result['提前结清违约金(修正)'] = statement.correctionSnapshot.earlySettlementPenalty ?? '';
            result['应还总额(修正)'] = statement.correctionSnapshot.totalPayableAmount ?? '';
            result['修正备注'] = statement.correctionSnapshot.remark ?? '';
            result['修正人'] = statement.correctionSnapshot.correctedBy;
            result['修正时间'] = (0, dayjs_1.default)(statement.correctionSnapshot.correctedAt).format('YYYY-MM-DD HH:mm:ss');
        }
        if (options.includeAnomalies) {
            const unresolvedAnomalies = statement.anomalies.filter((a) => !a.resolved);
            result['异常类型'] = unresolvedAnomalies.map((a) => a.type).join('; ');
            result['异常详情'] = unresolvedAnomalies.map((a) => a.message).join('; ');
            result['异常严重程度'] = unresolvedAnomalies
                .map((a) => a.severity)
                .join('; ');
        }
        return result;
    }
    exportApplicationsToCsv(applications, options) {
        const records = applications.map((app) => this.flattenApplication(app, options));
        if (records.length === 0) {
            return '';
        }
        const headers = Object.keys(records[0]).map((key) => ({
            id: key,
            title: key,
        }));
        const csvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
            header: headers,
        });
        return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
    }
    exportApplicationsToExcel(applications, options) {
        const records = applications.map((app) => this.flattenApplication(app, options));
        const worksheet = XLSX.utils.json_to_sheet(records);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '提前结清申请');
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }
    exportStatementsToCsv(statements, options) {
        const records = statements.map((s) => this.flattenStatement(s, options));
        if (records.length === 0) {
            return '';
        }
        const headers = Object.keys(records[0]).map((key) => ({
            id: key,
            title: key,
        }));
        const csvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
            header: headers,
        });
        return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
    }
    exportStatementsToExcel(statements, options) {
        const records = statements.map((s) => this.flattenStatement(s, options));
        const worksheet = XLSX.utils.json_to_sheet(records);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '结清单');
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }
    exportDetailedApplication(application, statement) {
        const lines = [];
        lines.push('='.repeat(60));
        lines.push('消费分期提前结清详细报告');
        lines.push('='.repeat(60));
        lines.push('');
        lines.push('【基本信息】');
        lines.push(`申请编号: ${application.applicationNo}`);
        lines.push(`合同编号: ${application.contractNo}`);
        lines.push(`申请人: ${application.applicant}`);
        lines.push(`申请日期: ${(0, dayjs_1.default)(application.applicationDate).format('YYYY-MM-DD HH:mm:ss')}`);
        lines.push(`当前状态: ${application.status}`);
        lines.push(`创建人: ${application.createdBy}`);
        lines.push('');
        lines.push('【金额明细 - 三段式对比】');
        lines.push(`剩余本金: 原始=${application.remainingPrincipal.original}元, 修正=${application.remainingPrincipal.corrected ?? '无'}, 最终=${application.remainingPrincipal.final}元`);
        lines.push(`剩余服务费: 原始=${application.remainingServiceFee.original}元, 修正=${application.remainingServiceFee.corrected ?? '无'}, 最终=${application.remainingServiceFee.final}元`);
        lines.push(`可退服务费: 原始=${application.refundableServiceFee.original}元, 修正=${application.refundableServiceFee.corrected ?? '无'}, 最终=${application.refundableServiceFee.final}元`);
        lines.push(`提前结清违约金: 原始=${application.earlySettlementPenalty.original}元, 修正=${application.earlySettlementPenalty.corrected ?? '无'}, 最终=${application.earlySettlementPenalty.final}元`);
        lines.push(`应还总额: 原始=${application.totalPayableAmount.original}元, 修正=${application.totalPayableAmount.corrected ?? '无'}, 最终=${application.totalPayableAmount.final}元`);
        lines.push('');
        lines.push('【异常标记】');
        if (application.anomalies.length > 0) {
            application.anomalies.forEach((a, i) => {
                lines.push(`  ${i + 1}. [${a.severity}] ${a.type}: ${a.message} (已解决: ${a.resolved ? '是' : '否'})`);
            });
        }
        else {
            lines.push('  无异常');
        }
        lines.push('');
        lines.push('【判断理由明细】');
        lines.push('');
        lines.push('■ 结清试算理由:');
        application.reasons.trialCalculation.forEach((r) => {
            lines.push(`  [${(0, dayjs_1.default)(r.timestamp).format('HH:mm:ss')}] ${r.message}`);
        });
        lines.push('');
        lines.push('■ 费用冲回理由:');
        application.reasons.feeReversal.forEach((r) => {
            lines.push(`  [${(0, dayjs_1.default)(r.timestamp).format('HH:mm:ss')}] ${r.message}`);
        });
        lines.push('');
        lines.push('■ 流水核对理由:');
        application.reasons.flowVerification.forEach((r) => {
            lines.push(`  [${(0, dayjs_1.default)(r.timestamp).format('HH:mm:ss')}] ${r.message}`);
        });
        lines.push('');
        lines.push('■ 状态流转理由:');
        application.reasons.stateTransition.forEach((r) => {
            lines.push(`  [${(0, dayjs_1.default)(r.timestamp).format('HH:mm:ss')}] ${r.message} (操作人: ${r.operator || '系统'})`);
        });
        lines.push('');
        if (application.remark) {
            lines.push('【备注】');
            lines.push(application.remark);
            lines.push('');
        }
        lines.push('='.repeat(60));
        lines.push(`报告生成时间: ${(0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss')}`);
        lines.push('='.repeat(60));
        return lines.join('\n');
    }
}
exports.ExportService = ExportService;
exports.exportService = new ExportService();
//# sourceMappingURL=ExportService.js.map