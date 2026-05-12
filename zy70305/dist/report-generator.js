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
exports.ReportGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ReportGenerator {
    constructor(outputDir) {
        this.outputDir = outputDir;
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    }
    generateMarkdown(result, filename = 'report.md') {
        const filePath = path.join(this.outputDir, filename);
        const content = this.buildMarkdownReport(result);
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    generateCsv(result, filename = 'report.csv') {
        const filePath = path.join(this.outputDir, filename);
        const content = this.buildCsvReport(result);
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    buildMarkdownReport(result) {
        const lines = [];
        const summary = result.summary;
        lines.push('# OpenAPI 契约漂移检测报告');
        lines.push('');
        lines.push(`生成时间: ${new Date().toISOString()}`);
        lines.push('');
        lines.push('## 概览');
        lines.push('');
        lines.push(`| 指标 | 数值 |`);
        lines.push(`|------|------|`);
        lines.push(`| 服务数 | ${summary.totalServices} |`);
        lines.push(`| 接口数 | ${summary.totalPaths} |`);
        lines.push(`| 差异总数 | ${summary.totalDiffs} |`);
        lines.push(`| 🔴 阻断级别 | ${summary.blockerCount} |`);
        lines.push(`| 🟡 警告级别 | ${summary.warningCount} |`);
        lines.push(`| 🔵 信息级别 | ${summary.infoCount} |`);
        lines.push(`| ❗ 调用方必须修改 | ${summary.callerMustChangeCount} |`);
        lines.push(`| ⚠️ 仅需关注 | ${summary.attentionOnlyCount} |`);
        lines.push(`| ✅ 可忽略 | ${summary.ignorableCount} |`);
        lines.push(`| 样本分析 | ${summary.samplesAnalyzed} 个样本, ${summary.sampleIssues} 个问题 |`);
        lines.push(`| 异常情况 | ${summary.anomaliesCount} 个 |`);
        lines.push(`| 豁免记录 | ${summary.exemptedCount} 个 |`);
        lines.push(`| 已确认 | ${summary.confirmedCount} 个 |`);
        lines.push('');
        if (summary.hasBlockers) {
            lines.push('⚠️ **存在阻断级别的变更，建议暂停发布并修复**');
            lines.push('');
        }
        if (result.filteredDiffs.length > 0) {
            const byImpact = this.groupBy(result.filteredDiffs, 'impact');
            if (byImpact['caller-must-change']) {
                lines.push('## ❗ 调用方必须修改');
                lines.push('');
                lines.push('这些变更会影响现有调用方，必须在调用方适配后才能发布。');
                lines.push('');
                lines.push(...this.renderDiffs(byImpact['caller-must-change'], result.confirmations));
                lines.push('');
            }
            if (byImpact['attention-only']) {
                lines.push('## ⚠️ 仅需关注');
                lines.push('');
                lines.push('这些变更可能影响调用方，建议关注并评估影响。');
                lines.push('');
                lines.push(...this.renderDiffs(byImpact['attention-only'], result.confirmations));
                lines.push('');
            }
            if (byImpact['ignorable']) {
                lines.push('## ✅ 可忽略');
                lines.push('');
                lines.push('这些变更是向后兼容的，可以安全发布。');
                lines.push('');
                lines.push(...this.renderDiffs(byImpact['ignorable'], result.confirmations));
                lines.push('');
            }
        }
        const sampleWithIssues = result.sampleAnalyses.filter(a => a.issues.length > 0);
        if (sampleWithIssues.length > 0) {
            lines.push('## 🔍 调用样本问题');
            lines.push('');
            lines.push('以下调用样本使用了已删除的字段或枚举值：');
            lines.push('');
            for (const analysis of sampleWithIssues) {
                lines.push(`### 样本: ${analysis.sample.source}#${analysis.sample.lineNumber || ''}`);
                lines.push('');
                lines.push(`- 服务: ${analysis.sample.serviceName || 'N/A'}`);
                lines.push(`- 接口: ${analysis.sample.operationId || `${analysis.sample.method} ${analysis.sample.path}`}`);
                lines.push('');
                lines.push('**问题:**');
                for (const issue of analysis.issues) {
                    lines.push(`- ${issue.description}`);
                }
                lines.push('');
            }
        }
        if (result.anomalies.length > 0) {
            lines.push('## ⚠️ 异常情况');
            lines.push('');
            for (const anomaly of result.anomalies) {
                lines.push(`- [${anomaly.type}] ${anomaly.message}`);
                if (anomaly.serviceName) {
                    lines.push(`  - 服务: ${anomaly.serviceName}`);
                }
                if (anomaly.path) {
                    lines.push(`  - 路径: ${anomaly.path}`);
                }
                lines.push(`  - 来源: ${anomaly.source}`);
            }
            lines.push('');
        }
        if (result.exemptions.length > 0) {
            lines.push('## 📋 豁免记录');
            lines.push('');
            lines.push('| ID | 服务 | 路径 | 方法 | 原因 | 过期时间 | 创建人 |');
            lines.push('|----|------|------|------|------|----------|--------|');
            for (const ex of result.exemptions) {
                lines.push(`| ${ex.id} | ${ex.serviceName} | ${ex.path} | ${ex.method.toUpperCase()} | ${ex.reason} | ${ex.expiresAt} | ${ex.createdBy} |`);
            }
            lines.push('');
        }
        if (result.confirmations.length > 0) {
            lines.push('## ✅ 确认记录');
            lines.push('');
            lines.push('以下变更已由负责人确认：');
            lines.push('');
            lines.push('| 服务 | 路径 | 方法 | 变更类型 | 字段 | 确认人 | 确认时间 | 备注 |');
            lines.push('|------|------|------|----------|------|--------|----------|------|');
            for (const conf of result.confirmations) {
                lines.push(`| ${conf.serviceName} | ${conf.path} | ${conf.method.toUpperCase()} | ${conf.changeType} | ${conf.field || '-'} | ${conf.confirmedBy} | ${conf.confirmedAt} | ${conf.notes || '-'} |`);
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    buildCsvReport(result) {
        const lines = [];
        lines.push([
            'ID',
            '服务名',
            '路径',
            '方法',
            '变更类型',
            '字段',
            '旧值',
            '新值',
            '描述',
            '严重级别',
            '影响级别',
            '状态',
            '确认人',
            '确认时间'
        ].join(','));
        for (const diff of result.filteredDiffs) {
            const confirmation = result.confirmations.find(c => c.serviceName === diff.serviceName &&
                c.path === diff.path &&
                c.method === diff.method &&
                c.changeType === diff.changeType &&
                c.field === diff.field);
            let status = '待处理';
            if (result.exemptions.some(ex => this.isExemptionMatch(ex, diff))) {
                status = '已豁免';
            }
            else if (confirmation) {
                status = '已确认';
            }
            lines.push([
                diff.id,
                diff.serviceName,
                diff.path,
                diff.method.toUpperCase(),
                diff.changeType,
                diff.field || '',
                diff.oldValue || '',
                diff.newValue || '',
                `"${diff.description.replace(/"/g, '""')}"`,
                diff.severity,
                diff.impact,
                status,
                confirmation?.confirmedBy || '',
                confirmation?.confirmedAt || ''
            ].join(','));
        }
        return lines.join('\n');
    }
    renderDiffs(diffs, confirmations) {
        const lines = [];
        const byService = this.groupBy(diffs, 'serviceName');
        for (const [service, serviceDiffs] of Object.entries(byService)) {
            lines.push(`### 服务: ${service}`);
            lines.push('');
            const byPath = this.groupBy(serviceDiffs, 'path');
            for (const [path, pathDiffs] of Object.entries(byPath)) {
                lines.push(`#### ${path}`);
                lines.push('');
                for (const diff of pathDiffs) {
                    const confirmation = confirmations.find(c => c.serviceName === diff.serviceName &&
                        c.path === diff.path &&
                        c.method === diff.method &&
                        c.changeType === diff.changeType &&
                        c.field === diff.field);
                    const severityIcon = diff.severity === 'blocker' ? '🔴' : diff.severity === 'warning' ? '🟡' : '🔵';
                    let line = `- ${severityIcon} [${diff.method.toUpperCase()}] ${diff.description}`;
                    if (confirmation) {
                        line += ` (已确认: ${confirmation.confirmedBy} @ ${confirmation.confirmedAt})`;
                    }
                    lines.push(line);
                }
                lines.push('');
            }
        }
        return lines;
    }
    groupBy(items, key) {
        return items.reduce((acc, item) => {
            const k = String(item[key]);
            if (!acc[k]) {
                acc[k] = [];
            }
            acc[k].push(item);
            return acc;
        }, {});
    }
    isExemptionMatch(ex, diff) {
        const now = new Date();
        if (new Date(ex.expiresAt) < now)
            return false;
        if (ex.serviceName !== diff.serviceName)
            return false;
        if (ex.path !== diff.path)
            return false;
        if (ex.method !== diff.method)
            return false;
        if (ex.changeType && ex.changeType !== diff.changeType)
            return false;
        if (ex.field && ex.field !== diff.field)
            return false;
        return true;
    }
}
exports.ReportGenerator = ReportGenerator;
//# sourceMappingURL=report-generator.js.map