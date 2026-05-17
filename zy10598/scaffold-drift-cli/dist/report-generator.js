"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerator = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
class ReportGenerator {
    async generateJsonReport(report, outputPath) {
        const timestamp = report.metadata.timestamp.replace(/[:.]/g, '-');
        const fileName = `drift-report-${timestamp}.json`;
        const fullPath = path_1.default.join(outputPath, fileName);
        await fs_extra_1.default.ensureDir(outputPath);
        await fs_extra_1.default.writeJson(fullPath, report, { spaces: 2 });
        console.log(chalk_1.default.green(`✓ JSON报告已保存: ${fullPath}`));
    }
    async generateMarkdownReport(report, outputPath) {
        const timestamp = report.metadata.timestamp.replace(/[:.]/g, '-');
        const fileName = `drift-report-${timestamp}.md`;
        const fullPath = path_1.default.join(outputPath, fileName);
        const content = this.generateMarkdownContent(report);
        await fs_extra_1.default.ensureDir(outputPath);
        await fs_extra_1.default.writeFile(fullPath, content, 'utf-8');
        console.log(chalk_1.default.green(`✓ Markdown报告已保存: ${fullPath}`));
    }
    generateMarkdownContent(report) {
        const normalDrifts = report.drifts.filter(d => d.status === 'normal');
        const riskDrifts = report.drifts.filter(d => d.status === 'risk');
        const unknownDrifts = report.drifts.filter(d => d.status === 'unknown');
        let content = `# 脚手架漂移检测报告

## 元数据

| 字段 | 值 |
|------|-----|
| 检测时间 | ${report.metadata.timestamp} |
| 运行ID | ${report.metadata.runId} |
| 仓库路径 | ${report.metadata.repoPath} |
| 模板路径 | ${report.metadata.templatePath} |
| 模板名称 | ${report.metadata.templateName} |
| 模板版本 | ${report.metadata.templateVersion} |

## 摘要

### 总体统计

| 指标 | 数量 |
|------|------|
| 检查文件数 | ${report.summary.totalFiles} |
| 检查配置数 | ${report.summary.totalConfigs} |
| 总漂移项 | ${report.summary.totalDrifts} |
| 正常项 | ${report.summary.normalItems} |
| 风险项 | ${report.summary.riskItems} |
| 无法处理 | ${report.summary.unknownItems} |

### 严重程度分布

| 严重程度 | 数量 |
|----------|------|
| 致命 (Critical) | ${report.summary.criticalDrifts} |
| 高 (High) | ${report.summary.highDrifts} |
| 中 (Medium) | ${report.summary.mediumDrifts} |
| 低 (Low) | ${report.summary.lowDrifts} |

`;
        if (riskDrifts.length > 0) {
            content += `## 风险项 (${riskDrifts.length})

| ID | 类型 | 路径 | 严重程度 | 描述 | 原因 |
|----|------|------|----------|------|------|
`;
            for (const drift of riskDrifts) {
                content += `| ${drift.id} | ${drift.type} | ${drift.path} | ${drift.severity} | ${drift.description} | ${drift.reason || '-'} |\n`;
            }
            content += '\n';
        }
        if (unknownDrifts.length > 0) {
            content += `## 无法处理项 (${unknownDrifts.length})

| ID | 类型 | 路径 | 严重程度 | 描述 | 原因 |
|----|------|------|----------|------|------|
`;
            for (const drift of unknownDrifts) {
                content += `| ${drift.id} | ${drift.type} | ${drift.path} | ${drift.severity} | ${drift.description} | ${drift.reason || '-'} |\n`;
            }
            content += '\n';
        }
        if (normalDrifts.length > 0) {
            content += `## 正常项 (${normalDrifts.length})

| ID | 类型 | 路径 | 描述 |
|----|------|------|------|
`;
            for (const drift of normalDrifts) {
                content += `| ${drift.id} | ${drift.type} | ${drift.path} | ${drift.description} |\n`;
            }
            content += '\n';
        }
        if (report.repairPreview.length > 0) {
            content += `## 修复预览

`;
            const autoFixable = report.repairPreview.filter(p => p.autoFixable);
            const manualRequired = report.repairPreview.filter(p => !p.autoFixable);
            if (autoFixable.length > 0) {
                content += `### 可自动修复 (${autoFixable.length})

`;
                for (const preview of autoFixable) {
                    content += `#### ${preview.description}

\`\`\`
${preview.preview}
\`\`\`

`;
                }
            }
            if (manualRequired.length > 0) {
                content += `### 需要手动处理 (${manualRequired.length})

`;
                for (const preview of manualRequired) {
                    content += `#### ${preview.description}

\`\`\`
${preview.preview}
\`\`\`

`;
                }
            }
        }
        content += `## 文件检查详情

| 路径 | 存在 | 必需 | 内容匹配 | 漂移数 |
|------|------|------|----------|--------|
`;
        for (const file of report.files) {
            content += `| ${file.path} | ${file.exists ? '✓' : '✗'} | ${file.required ? '是' : '否'} | ${file.contentMatch === true ? '✓' : file.contentMatch === false ? '✗' : '-'} | ${file.drifts.length} |\n`;
        }
        content += `
## 配置检查详情

| 路径 | 存在 | 必需 | 解析成功 | 漂移数 |
|------|------|------|----------|--------|
`;
        for (const config of report.configs) {
            content += `| ${config.path} | ${config.exists ? '✓' : '✗'} | ${config.required ? '是' : '否'} | ${config.parsed ? '✓' : '✗'} | ${config.drifts.length} |\n`;
        }
        content += `
---
*报告由 scaffold-drift-cli 自动生成*
`;
        return content;
    }
    printConsoleSummary(report) {
        console.log('\n' + chalk_1.default.bold('='.repeat(60)));
        console.log(chalk_1.default.bold('          脚手架漂移检测结果'));
        console.log(chalk_1.default.bold('='.repeat(60)) + '\n');
        console.log(chalk_1.default.cyan('📊 检测摘要:'));
        console.log(`  检查文件: ${report.summary.totalFiles} 个`);
        console.log(`  检查配置: ${report.summary.totalConfigs} 个`);
        console.log(`  发现漂移: ${report.summary.totalDrifts} 项\n`);
        if (report.summary.criticalDrifts > 0) {
            console.log(chalk_1.default.red(`  🔴 致命问题: ${report.summary.criticalDrifts} 项`));
        }
        if (report.summary.highDrifts > 0) {
            console.log(chalk_1.default.magenta(`  🟠 高风险: ${report.summary.highDrifts} 项`));
        }
        if (report.summary.mediumDrifts > 0) {
            console.log(chalk_1.default.yellow(`  🟡 中风险: ${report.summary.mediumDrifts} 项`));
        }
        if (report.summary.lowDrifts > 0) {
            console.log(chalk_1.default.gray(`  ⚪ 低风险: ${report.summary.lowDrifts} 项`));
        }
        console.log('\n' + chalk_1.default.cyan('📋 风险详情:'));
        const riskDrifts = report.drifts.filter(d => d.status === 'risk');
        for (const drift of riskDrifts.slice(0, 10)) {
            const color = this.getSeverityColor(drift.severity);
            console.log(`  ${color(`[${drift.severity.toUpperCase()}]`)} ${drift.description}`);
        }
        if (riskDrifts.length > 10) {
            console.log(chalk_1.default.gray(`  ... 还有 ${riskDrifts.length - 10} 项风险，请查看完整报告`));
        }
        console.log('\n' + chalk_1.default.bold('='.repeat(60)) + '\n');
    }
    getSeverityColor(severity) {
        switch (severity) {
            case 'critical': return chalk_1.default.red.bold;
            case 'high': return chalk_1.default.magenta;
            case 'medium': return chalk_1.default.yellow;
            case 'low': return chalk_1.default.gray;
            default: return chalk_1.default.white;
        }
    }
}
exports.ReportGenerator = ReportGenerator;
