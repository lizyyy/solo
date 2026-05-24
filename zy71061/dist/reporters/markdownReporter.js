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
exports.writeMarkdownReport = writeMarkdownReport;
const path = __importStar(require("path"));
const unitConverter_1 = require("../utils/unitConverter");
const fileReader_1 = require("../readers/fileReader");
function writeMarkdownReport(report, outputDir, name) {
    const filePath = path.join(outputDir, `${name}.md`);
    const content = generateMarkdown(report);
    (0, fileReader_1.writeFile)(filePath, content);
    return filePath;
}
function generateMarkdown(report) {
    const lines = [];
    lines.push('# 日志留存策略差异分析报告');
    lines.push('');
    lines.push(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
    lines.push('');
    lines.push('## 📊 摘要统计');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 服务总数 | ${report.summary.totalServices} |`);
    lines.push(`| 一致服务 | ${report.summary.consistentServices} |`);
    lines.push(`| 不一致服务 | ${report.summary.inconsistentServices} |`);
    lines.push(`| 严重问题 | ${report.summary.criticalIssues} |`);
    lines.push(`| 警告问题 | ${report.summary.warningIssues} |`);
    lines.push(`| 信息差异 | ${report.summary.infoIssues} |`);
    lines.push(`| 整体一致性 | ${report.summary.overallConsistencyScore}% |`);
    lines.push('');
    lines.push('## 📁 数据源统计');
    lines.push('');
    for (const source of report.sources) {
        lines.push(`- ${getSourceLabel(source.type)}: ${source.serviceCount} 个服务`);
    }
    lines.push('');
    lines.push('## ⚙️ 配置信息');
    lines.push('');
    lines.push('| 配置项 | 值 |');
    lines.push('|--------|----|');
    lines.push(`| 输出目录 | ${report.config.outputDir} |`);
    lines.push(`| 严重阈值 | >= ${report.config.severityThresholds.critical} 天 |`);
    lines.push(`| 警告阈值 | >= ${report.config.severityThresholds.warning} 天 |`);
    lines.push('');
    lines.push('**输入文件:**');
    for (const source of report.config.sources) {
        lines.push(`- \`${source}\``);
    }
    lines.push('');
    lines.push('## 🔍 服务差异详情');
    lines.push('');
    const sortedServices = [...report.services].sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
    for (const service of sortedServices) {
        lines.push(generateServiceMarkdown(service));
    }
    lines.push('## 📝 说明');
    lines.push('');
    lines.push('### 严重级别定义');
    lines.push('');
    lines.push(`- **严重 (Critical)**: 差异 >= ${report.config.severityThresholds.critical} 天`);
    lines.push(`- **警告 (Warning)**: 差异 >= ${report.config.severityThresholds.warning} 天 且 < ${report.config.severityThresholds.critical} 天`);
    lines.push('- **信息 (Info)**: 差异 < 警告阈值 或 完全一致');
    lines.push('');
    lines.push('### 退出码含义');
    lines.push('');
    lines.push('- `0`: 没有发现任何差异');
    lines.push('- `1`: 存在警告级别差异');
    lines.push('- `2`: 存在严重级别差异');
    lines.push('- `>2`: 执行错误');
    return lines.join('\n');
}
function generateServiceMarkdown(service) {
    const lines = [];
    const severityEmoji = getSeverityEmoji(service.severity);
    lines.push(`### ${severityEmoji} ${service.canonicalName}`);
    lines.push('');
    if (service.aliases.length > 0) {
        lines.push(`**别名:** ${service.aliases.join(', ')}`);
        lines.push('');
    }
    lines.push(`**一致性评分:** ${service.consistencyScore}%`);
    lines.push('');
    lines.push('**各源留存配置:**');
    lines.push('');
    lines.push('| 数据源 | 留存时间 | 天数 |');
    lines.push('|--------|----------|------|');
    for (const [source, days] of Object.entries(service.sources)) {
        if (days !== undefined) {
            lines.push(`| ${getSourceLabel(source)} | ${(0, unitConverter_1.formatRetention)(days)} | ${days} 天 |`);
        }
    }
    lines.push('');
    if (service.differences.length > 0) {
        lines.push('**差异详情:**');
        lines.push('');
        lines.push('| 比较 | 差异天数 | 差异比例 | 级别 |');
        lines.push('|------|----------|----------|------|');
        for (const diff of service.differences) {
            lines.push(`| ${getSourceLabel(diff.sourceA)} vs ${getSourceLabel(diff.sourceB)} | ${diff.diffDays} 天 | ${diff.diffPercentage}% | ${getSeverityLabel(diff.severity)} |`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function getSourceLabel(type) {
    const labels = {
        config: '配置中心',
        terraform: 'Terraform',
        platform: '实际平台',
    };
    return labels[type];
}
function getSeverityEmoji(severity) {
    const emojis = {
        critical: '🔴',
        warning: '🟡',
        info: '🔵',
    };
    return emojis[severity] || '⚪';
}
function getSeverityLabel(severity) {
    const labels = {
        critical: '严重',
        warning: '警告',
        info: '信息',
    };
    return labels[severity] || severity;
}
