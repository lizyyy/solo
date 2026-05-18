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
exports.generateConsoleReport = generateConsoleReport;
exports.generateJsonReport = generateJsonReport;
exports.generateMarkdownReport = generateMarkdownReport;
const fs = __importStar(require("fs"));
const chalk_1 = __importDefault(require("chalk"));
function formatIssue(issue, indent = '  ') {
    const severityColors = {
        critical: chalk_1.default.red.bold,
        warning: chalk_1.default.yellow.bold,
        info: chalk_1.default.blue.bold
    };
    const typeLabels = {
        expired_contraindication: '禁忌过期',
        package_mismatch: '套餐混项',
        missing_info: '信息缺失',
        other: '其他问题'
    };
    const lines = [];
    lines.push(`${indent}${severityColors[issue.severity](`[${typeLabels[issue.type]}]`)} ${issue.message}`);
    lines.push(`${indent}  来源: ${issue.source.file}:${issue.source.line}`);
    if (issue.type === 'expired_contraindication') {
        lines.push(`${indent}  解释: 该禁忌项的有效期已过，需要重新评估患者当前身体状况后才能进行理疗。`);
        lines.push(`${indent}         过期的禁忌记录无法作为当前理疗决策的依据，存在医疗安全风险。`);
    }
    else if (issue.type === 'package_mismatch') {
        lines.push(`${indent}  解释: 该理疗套餐的禁忌类型配置不符合标准分类规范。`);
        lines.push(`${indent}         "${issue.details.expectedCategory}"类套餐应只包含对应类别的禁忌项，`);
        lines.push(`${indent}         错误配置可能导致禁忌筛查判断失误，影响患者安全。`);
    }
    return lines.join('\n');
}
function generateConsoleReport(result) {
    const lines = [];
    lines.push(chalk_1.default.bold.cyan('\n══════════════════════════════════════════════════════════════'));
    lines.push(chalk_1.default.bold.cyan('          产后康复中心理疗禁忌筛查报告'));
    lines.push(chalk_1.default.bold.cyan('══════════════════════════════════════════════════════════════\n'));
    lines.push(`批次ID: ${chalk_1.default.gray(result.batchId)}`);
    lines.push(`处理时间: ${chalk_1.default.gray(new Date(result.processedAt).toLocaleString('zh-CN'))}`);
    lines.push(`输入文件: ${chalk_1.default.gray(result.inputFiles.join(', '))}\n`);
    lines.push(chalk_1.default.bold('【筛查统计】'));
    lines.push(`  总记录数: ${result.totalRecords}`);
    lines.push(`  通过: ${chalk_1.default.green(result.passed)}`);
    lines.push(`  失败: ${chalk_1.default.red(result.failed)}`);
    lines.push(`  警告: ${chalk_1.default.yellow(result.warnings)}\n`);
    if (result.records.length > 0) {
        lines.push(chalk_1.default.bold('【筛查详情】'));
        for (const record of result.records) {
            const resultColor = record.result === 'pass' ? chalk_1.default.green :
                record.result === 'fail' ? chalk_1.default.red : chalk_1.default.yellow;
            lines.push(`\n  患者: ${chalk_1.default.bold(record.patientName)} (${record.patientId})`);
            lines.push(`  套餐: ${record.treatmentPackageName} (${record.treatmentPackageId})`);
            lines.push(`  结果: ${resultColor(record.result.toUpperCase())}`);
            lines.push(`  来源: ${record.sourceFile}:${record.sourceLine}`);
            if (record.issues.length > 0) {
                lines.push(`  问题:`);
                for (const issue of record.issues) {
                    lines.push(formatIssue(issue, '    '));
                }
            }
        }
    }
    if (result.parseErrors.length > 0) {
        lines.push(chalk_1.default.red.bold('\n【解析错误汇总】'));
        for (const error of result.parseErrors) {
            const lineInfo = error.line ? `:${error.line}` : '';
            lines.push(`  ✗ ${error.file}${lineInfo}: ${error.message}`);
            lines.push(`    ${chalk_1.default.gray(error.error)}`);
        }
    }
    if (result.totalRecords === 0 && result.parseErrors.length === 0) {
        lines.push(chalk_1.default.yellow('\n  ℹ  未产生新的筛查记录（该批次数据已处理过，或数据为空）'));
    }
    lines.push(chalk_1.default.bold.cyan('\n══════════════════════════════════════════════════════════════\n'));
    return lines.join('\n');
}
function generateJsonReport(result, outputPath) {
    const sortedResult = {
        ...result,
        records: result.records.map(r => ({
            ...r,
            issues: r.issues.sort((a, b) => {
                const severityOrder = { critical: 0, warning: 1, info: 2 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            })
        })),
        parseErrors: result.parseErrors.sort((a, b) => a.file.localeCompare(b.file))
    };
    fs.writeFileSync(outputPath, JSON.stringify(sortedResult, null, 2), 'utf-8');
}
function generateMarkdownReport(result, outputPath) {
    const lines = [];
    lines.push('# 产后康复中心理疗禁忌筛查报告');
    lines.push('');
    lines.push(`- **批次ID**: ${result.batchId}`);
    lines.push(`- **处理时间**: ${new Date(result.processedAt).toLocaleString('zh-CN')}`);
    lines.push(`- **输入文件**: ${result.inputFiles.join(', ')}`);
    lines.push('');
    lines.push('## 筛查统计');
    lines.push('');
    lines.push('| 指标 | 数量 |');
    lines.push('|------|------|');
    lines.push(`| 总记录数 | ${result.totalRecords} |`);
    lines.push(`| 通过 | ${result.passed} |`);
    lines.push(`| 失败 | ${result.failed} |`);
    lines.push(`| 警告 | ${result.warnings} |`);
    lines.push('');
    if (result.records.length > 0) {
        lines.push('## 筛查详情');
        lines.push('');
        for (const record of result.records) {
            lines.push(`### 患者: ${record.patientName} (${record.patientId})`);
            lines.push('');
            lines.push(`- **套餐**: ${record.treatmentPackageName} (${record.treatmentPackageId})`);
            lines.push(`- **结果**: ${record.result.toUpperCase()}`);
            lines.push(`- **筛查日期**: ${record.screeningDate}`);
            lines.push(`- **来源**: \`${record.sourceFile}:${record.sourceLine}\``);
            if (record.issues.length > 0) {
                lines.push('');
                lines.push('#### 问题列表');
                lines.push('');
                for (const issue of record.issues) {
                    const severityEmoji = issue.severity === 'critical' ? '🔴' :
                        issue.severity === 'warning' ? '🟡' : '🔵';
                    lines.push(`${severityEmoji} **${issue.message}**`);
                    lines.push(`  - 来源: \`${issue.source.file}:${issue.source.line}\``);
                    if (issue.type === 'expired_contraindication') {
                        lines.push('  - 解释: 该禁忌项的有效期已过，需要重新评估患者当前身体状况后才能进行理疗。');
                        lines.push('    过期的禁忌记录无法作为当前理疗决策的依据，存在医疗安全风险。');
                    }
                    else if (issue.type === 'package_mismatch') {
                        lines.push('  - 解释: 该理疗套餐的禁忌类型配置不符合标准分类规范。');
                        lines.push(`    "${issue.details.expectedCategory}"类套餐应只包含对应类别的禁忌项，`);
                        lines.push('    错误配置可能导致禁忌筛查判断失误，影响患者安全。');
                    }
                    lines.push('');
                }
            }
            lines.push('');
        }
    }
    if (result.parseErrors.length > 0) {
        lines.push('## 解析错误汇总');
        lines.push('');
        for (const error of result.parseErrors) {
            const lineInfo = error.line ? `:${error.line}` : '';
            lines.push(`- **${error.file}${lineInfo}**: ${error.message}`);
            lines.push(`  - ${error.error}`);
        }
        lines.push('');
    }
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
}
