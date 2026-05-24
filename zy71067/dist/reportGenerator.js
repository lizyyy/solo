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
exports.generateReports = generateReports;
exports.getExitCode = getExitCode;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const riskAssessor_1 = require("./riskAssessor");
const checker_1 = require("./checker");
function generateReports(results, options) {
    const sortedResults = (0, riskAssessor_1.sortResultsByRisk)(results);
    const summary = createSummary(results, options.checkConfigs);
    const fullReport = {
        summary,
        results: sortedResults,
        config: {
            inputFiles: options.inputFiles,
            outputDir: options.outputDir,
            checkConfigs: options.checkConfigs,
            timestamp: new Date().toISOString(),
        },
    };
    const generatedFiles = [];
    if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
    }
    for (const format of options.formats) {
        const filePath = generateReportFile(fullReport, format, options);
        if (filePath) {
            generatedFiles.push(filePath);
        }
    }
    return { summary, files: generatedFiles };
}
function createSummary(results, checkConfigs) {
    const counts = {
        critical: 0,
        warning: 0,
        info: 0,
        safe: 0,
    };
    let overflowCount = 0;
    let placeholderIssueCount = 0;
    for (const result of results) {
        counts[result.riskLevel]++;
        if (result.widthOverflow > 0) {
            overflowCount++;
        }
        if (result.placeholderIssues.length > 0) {
            placeholderIssueCount++;
        }
    }
    return {
        totalChecks: results.length,
        criticalCount: counts.critical,
        warningCount: counts.warning,
        infoCount: counts.info,
        safeCount: counts.safe,
        overflowCount,
        placeholderIssueCount,
        checkedAt: new Date().toISOString(),
        configHash: (0, checker_1.generateConfigHash)(checkConfigs),
    };
}
function generateReportFile(report, format, options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `i18n-length-report-${report.summary.configHash}`;
    let fileName;
    let content;
    switch (format.toLowerCase()) {
        case 'json':
            fileName = `${baseName}.json`;
            content = generateJsonReport(report);
            break;
        case 'md':
        case 'markdown':
            fileName = `${baseName}.md`;
            content = generateMarkdownReport(report);
            break;
        case 'console':
        case 'terminal':
            printTerminalSummary(report);
            return null;
        default:
            console.warn(`不支持的输出格式: ${format}`);
            return null;
    }
    const filePath = path.join(options.outputDir, fileName);
    if (fs.existsSync(filePath) && !options.overwrite && !options.append) {
        console.warn(`文件已存在，跳过: ${filePath}`);
        return null;
    }
    if (options.append && fs.existsSync(filePath)) {
        const existingContent = fs.readFileSync(filePath, 'utf-8');
        if (format.toLowerCase() === 'json') {
            const existing = JSON.parse(existingContent);
            const merged = mergeReports(existing, report);
            content = JSON.stringify(merged, null, 2);
        }
        else {
            content = existingContent + '\n\n---\n\n' + content;
        }
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
}
function mergeReports(existing, newer) {
    const existingKeys = new Set(existing.results.map(r => `${r.key}-${r.locale}-${r.interfacePosition}`));
    const newResults = newer.results.filter(r => !existingKeys.has(`${r.key}-${r.locale}-${r.interfacePosition}`));
    const mergedResults = [...existing.results, ...newResults];
    return {
        ...newer,
        results: (0, riskAssessor_1.sortResultsByRisk)(mergedResults),
        summary: createSummary(mergedResults, newer.config.checkConfigs),
    };
}
function generateJsonReport(report) {
    return JSON.stringify(report, null, 2);
}
function generateMarkdownReport(report) {
    const lines = [];
    lines.push('# 多语言长度溢出检测报告');
    lines.push('');
    lines.push(`生成时间: ${new Date(report.summary.checkedAt).toLocaleString('zh-CN')}`);
    lines.push(`配置哈希: \`${report.summary.configHash}\``);
    lines.push('');
    lines.push('## 摘要');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总检测数 | ${report.summary.totalChecks} |`);
    lines.push(`| 🔴 严重 | ${report.summary.criticalCount} |`);
    lines.push(`| ⚠️ 警告 | ${report.summary.warningCount} |`);
    lines.push(`| ℹ️ 提示 | ${report.summary.infoCount} |`);
    lines.push(`| ✅ 安全 | ${report.summary.safeCount} |`);
    lines.push(`| 溢出问题 | ${report.summary.overflowCount} |`);
    lines.push(`| 占位符问题 | ${report.summary.placeholderIssueCount} |`);
    lines.push('');
    const criticalResults = report.results.filter(r => r.riskLevel === 'critical');
    const warningResults = report.results.filter(r => r.riskLevel === 'warning');
    const infoResults = report.results.filter(r => r.riskLevel === 'info');
    if (criticalResults.length > 0) {
        lines.push('## 🔴 严重问题');
        lines.push('');
        lines.push(...generateMarkdownResultTable(criticalResults));
        lines.push('');
    }
    if (warningResults.length > 0) {
        lines.push('## ⚠️ 警告问题');
        lines.push('');
        lines.push(...generateMarkdownResultTable(warningResults));
        lines.push('');
    }
    if (infoResults.length > 0) {
        lines.push('## ℹ️ 提示信息');
        lines.push('');
        lines.push(...generateMarkdownResultTable(infoResults));
        lines.push('');
    }
    lines.push('## 配置信息');
    lines.push('');
    lines.push('### 输入文件');
    lines.push('');
    for (const file of report.config.inputFiles) {
        lines.push(`- \`${file}\``);
    }
    lines.push('');
    lines.push('### 检测配置');
    lines.push('');
    for (const config of report.config.checkConfigs) {
        lines.push(`- **${config.interfacePosition}** (${config.locale}):`);
        lines.push(`  - 最大宽度: ${config.maxWidth} 单位`);
        if (config.maxChars) {
            lines.push(`  - 最大字符数: ${config.maxChars}`);
        }
        if (config.placeholders?.length) {
            lines.push(`  - 预期占位符: ${config.placeholders.join(', ')}`);
        }
    }
    lines.push('');
    return lines.join('\n');
}
function generateMarkdownResultTable(results) {
    const lines = [];
    lines.push('| Key | 语言 | 位置 | 原文 | 宽度 | 限制 | 溢出 | 说明 |');
    lines.push('|-----|------|------|------|------|------|------|------|');
    for (const result of results) {
        const keyDisplay = result.pluralForm
            ? `${result.key} [${result.pluralForm}]`
            : result.key;
        const truncatedText = result.originalText.length > 30
            ? result.originalText.substring(0, 27) + '...'
            : result.originalText;
        lines.push(`| ${keyDisplay} | ${result.locale} | ${result.interfacePosition} | ` +
            `${escapeMarkdown(truncatedText)} | ${result.widthResult.charWidth} | ` +
            `${result.maxWidth} | ${result.widthOverflow} | ${result.riskExplanation} |`);
    }
    return lines;
}
function escapeMarkdown(text) {
    return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
function printTerminalSummary(report) {
    const summary = report.summary;
    console.log('\n' + chalk_1.default.bold('='.repeat(60)));
    console.log(chalk_1.default.bold('        多语言长度溢出检测报告'));
    console.log(chalk_1.default.bold('='.repeat(60)));
    console.log('');
    console.log(chalk_1.default.gray(`检测时间: ${new Date(summary.checkedAt).toLocaleString('zh-CN')}`));
    console.log(chalk_1.default.gray(`配置哈希: ${summary.configHash}`));
    console.log('');
    const barLength = 40;
    const safeRatio = summary.safeCount / summary.totalChecks;
    const safeBar = '█'.repeat(Math.round(barLength * safeRatio));
    const otherBar = '░'.repeat(barLength - safeBar.length);
    console.log('整体状况:');
    console.log(`${chalk_1.default.green(safeBar)}${chalk_1.default.gray(otherBar)} ${Math.round(safeRatio * 100)}%`);
    console.log('');
    console.log(chalk_1.default.bold('摘要统计:'));
    console.log(`  总检测数: ${summary.totalChecks}`);
    console.log(`  ${chalk_1.default.red('🔴 严重:')} ${summary.criticalCount}`);
    console.log(`  ${chalk_1.default.yellow('⚠️ 警告:')} ${summary.warningCount}`);
    console.log(`  ${chalk_1.default.blue('ℹ️ 提示:')} ${summary.infoCount}`);
    console.log(`  ${chalk_1.default.green('✅ 安全:')} ${summary.safeCount}`);
    console.log(`  溢出问题: ${summary.overflowCount}`);
    console.log(`  占位符问题: ${summary.placeholderIssueCount}`);
    console.log('');
    const criticalResults = report.results.filter(r => r.riskLevel === 'critical');
    const warningResults = report.results.filter(r => r.riskLevel === 'warning');
    if (criticalResults.length > 0) {
        console.log(chalk_1.default.red.bold('🔴 严重问题:'));
        for (const result of criticalResults.slice(0, 5)) {
            printTerminalResult(result, 'red');
        }
        if (criticalResults.length > 5) {
            console.log(chalk_1.default.red(`  ... 还有 ${criticalResults.length - 5} 个严重问题`));
        }
        console.log('');
    }
    if (warningResults.length > 0) {
        console.log(chalk_1.default.yellow.bold('⚠️ 警告问题:'));
        for (const result of warningResults.slice(0, 3)) {
            printTerminalResult(result, 'yellow');
        }
        if (warningResults.length > 3) {
            console.log(chalk_1.default.yellow(`  ... 还有 ${warningResults.length - 3} 个警告问题`));
        }
        console.log('');
    }
    const exitCode = summary.criticalCount > 0 ? 2 : summary.warningCount > 0 ? 1 : 0;
    console.log(chalk_1.default.gray(`退出码: ${exitCode}`));
}
function printTerminalResult(result, color) {
    const colorFn = color === 'red' ? chalk_1.default.red : color === 'yellow' ? chalk_1.default.yellow : chalk_1.default.blue;
    const keyDisplay = result.pluralForm
        ? `${result.key} [${result.pluralForm}]`
        : result.key;
    console.log(colorFn(`  [${(0, riskAssessor_1.getRiskLevelEmoji)(result.riskLevel)} ${(0, riskAssessor_1.getRiskLevelLabel)(result.riskLevel)}] ${keyDisplay}`));
    console.log(colorFn(`    语言: ${result.locale}, 位置: ${result.interfacePosition}`));
    console.log(colorFn(`    宽度: ${result.widthResult.charWidth}/${result.maxWidth} (溢出: ${result.widthOverflow})`));
    console.log(colorFn(`    原文: ${result.originalText}`));
    console.log(colorFn(`    说明: ${result.riskExplanation}`));
}
function getExitCode(summary) {
    if (summary.criticalCount > 0)
        return 2;
    if (summary.warningCount > 0)
        return 1;
    return 0;
}
//# sourceMappingURL=reportGenerator.js.map