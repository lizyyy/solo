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
const json2csv_1 = require("json2csv");
const date_1 = require("../utils/date");
class ReportService {
    generateSummary(results) {
        const summary = {
            totalStudents: results.length,
            totalChecked: results.filter((r) => r.healthCheck).length,
            pending: results.filter((r) => r.status === 'PENDING').length,
            approved: results.filter((r) => r.status === 'APPROVED').length,
            rejected: results.filter((r) => r.status === 'REJECTED').length,
            needsMoreInfo: results.filter((r) => r.status === 'NEEDS_MORE_INFO').length,
            feverCases: results.filter((r) => r.discrepancies.some((d) => d.type === 'FEVER_DETECTED')).length,
            overdueMedications: results.filter((r) => r.discrepancies.some((d) => d.type === 'OVERDUE_MEDICATION')).length,
            unconfirmedMedications: results.filter((r) => r.discrepancies.some((d) => d.type === 'PARENT_NOT_CONFIRMED')).length,
            discrepanciesByType: this.countDiscrepanciesByType(results),
        };
        return summary;
    }
    countDiscrepanciesByType(results) {
        const counts = {
            FEVER_DETECTED: 0,
            OVERDUE_MEDICATION: 0,
            PARENT_NOT_CONFIRMED: 0,
            STUDENT_NOT_IN_CLASS: 0,
            MEDICATION_NOT_RECORDED: 0,
            SYMPTOMS_UNCHECKED: 0,
            DATA_MISMATCH: 0,
        };
        for (const result of results) {
            for (const discrepancy of result.discrepancies) {
                counts[discrepancy.type]++;
            }
        }
        return counts;
    }
    generateExportReport(results, generatedBy) {
        return {
            summary: this.generateSummary(results),
            results: results,
            generatedAt: (0, date_1.formatDate)(new Date()),
            generatedBy,
        };
    }
    exportToJSON(report, filePath) {
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
    }
    exportToCSV(results, filePath) {
        const flattened = results.map((result) => ({
            对账日期: result.reconciliationDate,
            学号: result.studentId,
            姓名: result.studentName,
            班级: result.className,
            状态: this.translateStatus(result.status),
            晨检体温: result.healthCheck?.temperature || '无记录',
            是否隔离: result.healthCheck?.isIsolated ? '是' : '否',
            用药名称: result.medication?.medicationName || '无',
            家长确认: result.medication?.parentConfirmed ? '已确认' : '未确认',
            药品有效期: result.medication?.expiryDate || '无',
            差异数量: result.discrepancies.length,
            差异说明: result.discrepancies.map((d) => d.description).join('; '),
            审核人: result.reviewedBy || '未审核',
            审核时间: result.reviewedAt || '无',
            审核备注: result.reviewNotes || '无',
        }));
        const csv = (0, json2csv_1.parse)(flattened);
        fs.writeFileSync(filePath, csv, 'utf-8');
    }
    generateTextReport(report) {
        const { summary, results, generatedAt, generatedBy } = report;
        let text = `
═══════════════════════════════════════════════════════════════
              晨检对账日报表
═══════════════════════════════════════════════════════════════
生成时间: ${generatedAt}
生成人: ${generatedBy}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                           汇总统计
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

学生总数: ${summary.totalStudents} 人
已完成晨检: ${summary.totalChecked} 人 (${((summary.totalChecked / summary.totalStudents) *
            100).toFixed(1)}%)

状态分布:
  ✅ 已通过: ${summary.approved} 人
  ⏳ 待处理: ${summary.pending} 人
  ❌ 已驳回: ${summary.rejected} 人
  📋 需补材料: ${summary.needsMoreInfo} 人

重点关注事项:
  🌡️ 发热病例: ${summary.feverCases} 人 (需立即隔离处理)
  ⚠️ 药品过期: ${summary.overdueMedications} 项
  ❓ 未获家长确认: ${summary.unconfirmedMedications} 项

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                          明细记录
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        const statusGroups = {
            REJECTED: [],
            NEEDS_MORE_INFO: [],
            PENDING: [],
            APPROVED: [],
        };
        for (const result of results) {
            statusGroups[result.status].push(result);
        }
        for (const [status, groupResults] of Object.entries(statusGroups)) {
            if (groupResults.length === 0)
                continue;
            text += `
┌─────────────────────────────────────────────────────────────┐
│ 【${this.translateStatus(status)}】${groupResults.length}人
└─────────────────────────────────────────────────────────────┘
`;
            for (const result of groupResults) {
                text += this.formatResultDetail(result);
            }
        }
        text += `
═══════════════════════════════════════════════════════════════
                           报表结束
═══════════════════════════════════════════════════════════════
`;
        return text;
    }
    formatResultDetail(result) {
        let detail = `
  ▶ ${result.studentName} (${result.studentId}) - ${result.className}
    ├─ 晨检: ${this.formatHealthCheck(result)}
    ├─ 用药: ${this.formatMedication(result)}
    └─ 结论: `;
        if (result.discrepancies.length > 0) {
            detail += `发现 ${result.discrepancies.length} 项问题\n`;
            for (const [index, discrepancy] of result.discrepancies.entries()) {
                const isLast = index === result.discrepancies.length - 1;
                const prefix = isLast ? '       └─' : '       ├─';
                detail += `${prefix} [${this.translateSeverity(discrepancy.severity)}] ${discrepancy.description}\n`;
                detail += `          ▶ 说明: ${discrepancy.explanation}\n`;
            }
        }
        else {
            detail += '正常\n';
        }
        if (result.reviewedBy) {
            detail += `
    ┌─ 审核记录 ────────────────────────────────────────────────
    │ 审核人: ${result.reviewedBy}
    │ 审核时间: ${result.reviewedAt}
    │ 审核意见: ${result.reviewNotes || '无'}
    └───────────────────────────────────────────────────────────
`;
        }
        return detail;
    }
    formatHealthCheck(result) {
        if (!result.healthCheck) {
            return '无记录';
        }
        const hc = result.healthCheck;
        const feverMarker = hc.temperature >= 37.3 ? '🌡️' : '✅';
        return `${feverMarker} ${hc.temperature}°C ${hc.isIsolated ? '已隔离' : ''} 检查人:${hc.checker}`;
    }
    formatMedication(result) {
        if (!result.medication) {
            return '无授权';
        }
        const med = result.medication;
        const confirmMarker = med.parentConfirmed ? '✅' : '❌';
        const expiryMarker = new Date(med.expiryDate) < new Date() ? '⚠️' : '✅';
        return `${confirmMarker}${expiryMarker} ${med.medicationName} (有效期至:${med.expiryDate})`;
    }
    translateStatus(status) {
        const mapping = {
            PENDING: '待处理',
            APPROVED: '已通过',
            REJECTED: '已驳回',
            NEEDS_MORE_INFO: '需补材料',
        };
        return mapping[status];
    }
    translateSeverity(severity) {
        const mapping = {
            HIGH: '高风险',
            MEDIUM: '中风险',
            LOW: '低风险',
        };
        return mapping[severity];
    }
    exportTextReport(report, filePath) {
        const text = this.generateTextReport(report);
        fs.writeFileSync(filePath, text, 'utf-8');
    }
}
exports.ReportService = ReportService;
