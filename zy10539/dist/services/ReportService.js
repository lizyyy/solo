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
exports.reportService = exports.ReportService = void 0;
const CorrectionModel_1 = require("../models/CorrectionModel");
const crypto = __importStar(require("crypto"));
function generateId() {
    return crypto.randomUUID();
}
const STATUS_DISPLAY_MAP = {
    DRAFT: '草稿',
    PREVIEWED: '已预览',
    PENDING_APPROVAL: '待审批',
    APPROVED: '已批准',
    EXECUTING: '执行中',
    COMPLETED: '已完成',
    REJECTED: '已拒绝',
    ROLLED_BACK: '已回滚',
    EXCEPTION: '异常'
};
const EXCEPTION_TYPE_DISPLAY_MAP = {
    ASSET_NOT_FOUND: '资产未找到',
    TAG_CONFLICT: '标签冲突',
    COST_CALCULATION_ERROR: '成本计算错误',
    PERMISSION_DENIED: '权限不足',
    EXECUTION_FAILED: '执行失败',
    ROLLBACK_FAILED: '回滚失败'
};
class ReportService {
    async generateReport(correctionId, generatedBy) {
        const correction = await CorrectionModel_1.correctionStorage.getCorrection(correctionId);
        if (!correction) {
            throw new Error('Correction request not found');
        }
        const exceptions = await CorrectionModel_1.correctionStorage.getExceptionsByCorrection(correctionId);
        const successfulCount = correction.assets.filter(a => correction.status === 'COMPLETED' || correction.status === 'ROLLED_BACK').length;
        const report = {
            id: generateId(),
            correctionId,
            generatedAt: new Date(),
            generatedBy,
            summary: {
                totalAssets: correction.assets.length,
                successfulCorrections: successfulCount,
                failedCorrections: exceptions.filter(e => !e.resolved).length,
                totalCostChange: correction.costImpacts?.reduce((sum, c) => sum + c.costChange, 0) || 0
            },
            details: correction.assets.map((asset, index) => ({
                assetId: asset.assetId,
                assetName: asset.assetName || `资产-${String(index + 1).padStart(4, '0')}`,
                previousTags: asset.currentTags,
                newTags: asset.targetTags,
                previousCostProject: asset.originalCostProject || '未设置',
                newCostProject: asset.costProject || '继承原有',
                costImpact: correction.costImpacts?.[index]?.costChange || 0,
                status: STATUS_DISPLAY_MAP[correction.status] || correction.status,
                remarks: this.generateAssetRemarks(asset, correction)
            })),
            exceptions: exceptions.map(e => ({
                ...e,
                type: e.type
            })),
            auditTrail: this.generateAuditTrailFromCorrection(correction)
        };
        await CorrectionModel_1.correctionStorage.saveReport(report);
        return report;
    }
    async exportToMarkdown(report) {
        const lines = [];
        lines.push(`# 资产标签纠错报告\n`);
        lines.push(`> 报告编号: ${report.id}`);
        lines.push(`> 生成时间: ${this.formatDate(report.generatedAt)}`);
        lines.push(`> 生成人: ${report.generatedBy}`);
        lines.push(`> 关联申请: ${report.correctionId}\n`);
        lines.push(`## 一、执行概览\n`);
        lines.push(`| 指标 | 数值 | 说明 |`);
        lines.push(`|------|------|------|`);
        lines.push(`| 涉及资产总数 | ${report.summary.totalAssets} 台 | 本次纠错涉及的云资产数量 |`);
        lines.push(`| 成功修正 | ${report.summary.successfulCorrections} 台 | 标签已成功更新的资产 |`);
        lines.push(`| 修正失败 | ${report.summary.failedCorrections} 台 | 需要人工介入处理的资产 |`);
        lines.push(`| 累计成本变动 | ${this.formatCurrency(report.summary.totalCostChange)} | 预估的月度成本变化金额 |\n`);
        if (report.summary.totalCostChange !== 0) {
            const trend = report.summary.totalCostChange > 0 ? '增加 ⬆️' : '减少 ⬇️';
            lines.push(`> 💡 **成本提示**: 本次标签修正后，预计月度成本将${trend} ${Math.abs(report.summary.totalCostChange).toFixed(2)} 元\n`);
        }
        lines.push(`## 二、明细数据\n`);
        for (const detail of report.details) {
            lines.push(`### ${detail.assetName} (${detail.assetId})`);
            lines.push(`- **当前状态**: ${detail.status}`);
            lines.push(`- **成本项目变化**: ${detail.previousCostProject} → ${detail.newCostProject}`);
            lines.push(`- **成本影响**: ${this.formatCurrency(detail.costImpact)}`);
            if (detail.remarks) {
                lines.push(`- **备注**: ${detail.remarks}`);
            }
            lines.push(`\n#### 标签变更对比\n`);
            lines.push(`| 标签键 | 变更前 | 变更后 | 变更类型 |`);
            lines.push(`|--------|--------|--------|----------|`);
            const allKeys = new Set([
                ...Object.keys(detail.previousTags),
                ...Object.keys(detail.newTags)
            ]);
            for (const key of allKeys) {
                const before = detail.previousTags[key] || '-';
                const after = detail.newTags[key] || '-';
                let changeType = '-';
                if (before === '-' && after !== '-') {
                    changeType = '✅ 新增';
                }
                else if (before !== '-' && after === '-') {
                    changeType = '❌ 删除';
                }
                else if (before !== after) {
                    changeType = '✏️ 修改';
                }
                else {
                    changeType = '➖ 不变';
                }
                lines.push(`| ${key} | ${before} | ${after} | ${changeType} |`);
            }
            lines.push('\n');
        }
        if (report.exceptions.length > 0) {
            lines.push(`## 三、异常记录\n`);
            for (const ex of report.exceptions) {
                const statusDisplay = ex.resolved ? '✅ 已解决' : '⚠️ 待处理';
                lines.push(`### ${EXCEPTION_TYPE_DISPLAY_MAP[ex.type] || ex.type} ${statusDisplay}`);
                lines.push(`- **发生时间**: ${this.formatDate(ex.timestamp)}`);
                lines.push(`- **异常描述**: ${ex.message}`);
                if (ex.resolved && ex.resolution) {
                    lines.push(`- **处理人**: ${ex.resolvedBy}`);
                    lines.push(`- **处理时间**: ${ex.resolvedAt ? this.formatDate(ex.resolvedAt) : '-'}`);
                    lines.push(`- **解决方案**: ${ex.resolution}`);
                }
                lines.push(`\n#### 处理依据\n`);
                for (const evidence of ex.processingEvidence) {
                    lines.push(`- ${evidence}`);
                }
                lines.push('\n');
            }
        }
        lines.push(`## 四、审批轨迹\n`);
        lines.push(`| 时间 | 操作 | 操作人 | 备注 |`);
        lines.push(`|------|------|--------|------|`);
        for (const trail of report.auditTrail) {
            lines.push(`| ${this.formatDate(trail.timestamp)} | ${trail.action} | ${trail.operator} | ${trail.comment || '-'} |`);
        }
        lines.push('\n');
        lines.push(`---`);
        lines.push(`*此报告由资产标签纠错系统自动生成*`);
        return lines.join('\n');
    }
    async exportToCSV(report) {
        const lines = [];
        lines.push('资产编号,资产名称,状态,原成本项目,新成本项目,成本影响,标签变更说明');
        for (const detail of report.details) {
            const tagChanges = this.summarizeTagChanges(detail.previousTags, detail.newTags);
            lines.push([
                detail.assetId,
                detail.assetName,
                detail.status,
                detail.previousCostProject,
                detail.newCostProject,
                detail.costImpact.toFixed(2),
                `"${tagChanges}"`
            ].join(','));
        }
        return lines.join('\n');
    }
    async getReport(id) {
        return CorrectionModel_1.correctionStorage.getReport(id);
    }
    async getReportsByCorrection(correctionId) {
        return CorrectionModel_1.correctionStorage.getReportsByCorrection(correctionId);
    }
    formatDate(date) {
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    formatCurrency(amount) {
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: 'CNY'
        }).format(amount);
    }
    generateAssetRemarks(asset, correction) {
        const remarks = [];
        if (asset.costProject && asset.costProject !== asset.originalCostProject) {
            remarks.push('成本项目已调整');
        }
        const hasException = correction.exceptions.some(e => !e.resolved && e.originalInput && JSON.stringify(e.originalInput).includes(asset.assetId));
        if (hasException) {
            remarks.push('存在异常待处理');
        }
        return remarks.join('；') || '';
    }
    generateAuditTrailFromCorrection(correction) {
        const trails = [];
        if (correction.createdAt) {
            trails.push({
                timestamp: correction.createdAt,
                action: '创建申请',
                operator: correction.applicant || '系统'
            });
        }
        if (correction.approvedAt) {
            trails.push({
                timestamp: correction.approvedAt,
                action: correction.status === 'REJECTED' ? '驳回申请' : '审批通过',
                operator: correction.approver || '审批人',
                comment: correction.approvalComment
            });
        }
        return trails;
    }
    summarizeTagChanges(previous, current) {
        const changes = [];
        const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);
        for (const key of allKeys) {
            const before = previous[key];
            const after = current[key];
            if (before === undefined && after !== undefined) {
                changes.push(`新增${key}:${after}`);
            }
            else if (before !== undefined && after === undefined) {
                changes.push(`删除${key}`);
            }
            else if (before !== after) {
                changes.push(`${key}:${before}→${after}`);
            }
        }
        return changes.join('；') || '无变更';
    }
}
exports.ReportService = ReportService;
exports.reportService = new ReportService();
//# sourceMappingURL=ReportService.js.map