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
exports.Reporter = void 0;
exports.createReporter = createReporter;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const utils_1 = require("./utils");
class Reporter {
    constructor(report, options) {
        this.report = report;
        this.options = options;
    }
    printSummary() {
        if (this.options.quiet)
            return;
        const { summary, issues } = this.report;
        const totalIssues = summary.criticalIssues + summary.highIssues + summary.mediumIssues + summary.lowIssues;
        console.log('\n' + chalk_1.default.bold('═══════════════════════════════════════════════════════'));
        console.log(chalk_1.default.bold('           SOURCEMAP 泄漏检查报告'));
        console.log(chalk_1.default.bold('═══════════════════════════════════════════════════════'));
        console.log(`扫描时间: ${new Date(summary.scanTimestamp).toLocaleString()}`);
        console.log(`扫描耗时: ${(0, utils_1.formatDuration)(summary.scanDuration)}`);
        console.log(`扫描文件: ${summary.scannedFiles} / ${summary.totalFiles}`);
        if (summary.excludedFiles > 0) {
            console.log(chalk_1.default.gray(`例外排除: ${summary.excludedFiles} 个文件`));
        }
        console.log('');
        if (totalIssues === 0 && summary.expiredExceptions === 0) {
            console.log(chalk_1.default.green.bold('✅ 恭喜! 未发现 sourcemap 泄漏问题'));
        }
        else {
            console.log(chalk_1.default.red.bold(`❌ 发现 ${totalIssues} 个 ${(0, utils_1.pluralize)(totalIssues, '问题')}`));
            console.log('');
            this.printIssueBreakdown(summary);
            console.log('');
            this.printTopIssues(issues);
        }
        if (summary.expiredExceptions > 0) {
            console.log('');
            console.log(chalk_1.default.yellow.bold(`⚠️  发现 ${summary.expiredExceptions} 个已过期的例外规则`));
        }
        console.log(chalk_1.default.bold('═══════════════════════════════════════════════════════\n'));
    }
    printIssueBreakdown(summary) {
        const items = [
            { count: summary.criticalIssues, label: '严重', color: chalk_1.default.red.bold },
            { count: summary.highIssues, label: '高危', color: chalk_1.default.red },
            { count: summary.mediumIssues, label: '中等', color: chalk_1.default.yellow },
            { count: summary.lowIssues, label: '轻微', color: chalk_1.default.gray },
        ];
        const parts = items
            .filter(item => item.count > 0)
            .map(item => item.color(`${item.count} ${item.label}`));
        console.log(`  问题分级: ${parts.join(' | ')}`);
    }
    printTopIssues(issues) {
        const sortedIssues = [...issues].sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
        const topIssues = sortedIssues.slice(0, 10);
        for (const issue of topIssues) {
            this.printIssue(issue);
        }
        if (sortedIssues.length > 10) {
            console.log(chalk_1.default.gray(`  ... 还有 ${sortedIssues.length - 10} 个问题，详见完整报告`));
        }
    }
    printIssue(issue) {
        const severityColors = {
            critical: chalk_1.default.red.bold,
            high: chalk_1.default.red,
            medium: chalk_1.default.yellow,
            low: chalk_1.default.gray,
        };
        const severityLabels = {
            critical: '严重',
            high: '高危',
            medium: '中等',
            low: '轻微',
        };
        const color = severityColors[issue.severity];
        const label = severityLabels[issue.severity];
        console.log(`  ${color(`[${label}]`)} ${issue.message}`);
        console.log(`      ${chalk_1.default.gray('文件:')} ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
        if (this.options.verbose) {
            console.log(`      ${chalk_1.default.gray('建议:')} ${issue.details.suggestedFix}`);
        }
        console.log('');
    }
    async writeJsonReport() {
        const outputPath = path.resolve(`${this.options.output}.json`);
        const outputDir = path.dirname(outputPath);
        await fs.promises.mkdir(outputDir, { recursive: true });
        await fs.promises.writeFile(outputPath, JSON.stringify(this.report, null, 2), 'utf-8');
        if (!this.options.quiet) {
            console.log(chalk_1.default.green(`📄 JSON 报告已保存: ${outputPath}`));
        }
        return outputPath;
    }
    async writeMarkdownReport() {
        const outputPath = path.resolve(`${this.options.output}.md`);
        const outputDir = path.dirname(outputPath);
        const content = this.generateMarkdownReport();
        await fs.promises.mkdir(outputDir, { recursive: true });
        await fs.promises.writeFile(outputPath, content, 'utf-8');
        if (!this.options.quiet) {
            console.log(chalk_1.default.green(`📄 Markdown 报告已保存: ${outputPath}`));
        }
        return outputPath;
    }
    generateMarkdownReport() {
        const { summary, issues, exceptions, metadata } = this.report;
        const totalIssues = summary.criticalIssues + summary.highIssues + summary.mediumIssues + summary.lowIssues;
        let md = '# Sourcemap 泄漏检查报告\n\n';
        md += '## 扫描概览\n\n';
        md += `| 项目 | 数值 |\n`;
        md += `|------|------|\n`;
        md += `| 扫描时间 | ${new Date(summary.scanTimestamp).toLocaleString()} |\n`;
        md += `| 扫描耗时 | ${(0, utils_1.formatDuration)(summary.scanDuration)} |\n`;
        md += `| 总文件数 | ${summary.totalFiles} |\n`;
        md += `| 已扫描文件 | ${summary.scannedFiles} |\n`;
        md += `| 例外排除文件 | ${summary.excludedFiles} |\n`;
        md += `| 问题总数 | ${totalIssues} |\n`;
        if (summary.expiredExceptions > 0) {
            md += `| 过期例外规则 | ${summary.expiredExceptions} |\n`;
        }
        md += '\n';
        md += '## 问题分级统计\n\n';
        md += `- **严重**: ${summary.criticalIssues}\n`;
        md += `- **高危**: ${summary.highIssues}\n`;
        md += `- **中等**: ${summary.mediumIssues}\n`;
        md += `- **轻微**: ${summary.lowIssues}\n\n`;
        if (issues.length > 0) {
            md += '## 问题详情\n\n';
            const groupedIssues = {
                critical: issues.filter(i => i.severity === 'critical'),
                high: issues.filter(i => i.severity === 'high'),
                medium: issues.filter(i => i.severity === 'medium'),
                low: issues.filter(i => i.severity === 'low'),
            };
            const severityHeadings = {
                critical: '### 🔴 严重问题',
                high: '### 🟠 高危问题',
                medium: '### 🟡 中等问题',
                low: '### ⚪ 轻微问题',
            };
            const typeDescriptions = {
                sourcemap_file: '发现 sourcemap 文件',
                sourcemap_reference: '发现 sourcemap 引用',
                hidden_sourcemap: '发现隐藏的 sourcemap 引用',
                publicly_accessible: 'Sourcemap 可能公开可访问',
                expired_exception: '例外规则已过期',
            };
            for (const [severity, list] of Object.entries(groupedIssues)) {
                if (list.length === 0)
                    continue;
                md += `${severityHeadings[severity]}\n\n`;
                for (const issue of list) {
                    md += `#### ${typeDescriptions[issue.type] || issue.type}\n\n`;
                    md += `- **文件**: \`${issue.file}\`${issue.line ? ` (行 ${issue.line}，列 ${issue.column})` : ''}\n`;
                    md += `- **描述**: ${issue.message}\n`;
                    md += `- **建议修复**: ${issue.details.suggestedFix}\n`;
                    if (issue.details.reference) {
                        md += `- **引用详情**:\n`;
                        md += `  - 类型: ${issue.details.reference.type}\n`;
                        md += `  - 值: \`${(0, utils_1.truncateString)(issue.details.reference.value, 100)}\`\n`;
                    }
                    if (issue.details.publicUrl) {
                        md += `- **公开 URL**: \`${issue.details.publicUrl}\`\n`;
                    }
                    if (issue.details.exception) {
                        md += `- **例外规则**:\n`;
                        md += `  - 路径: ${issue.details.exception.path}\n`;
                        md += `  - 原因: ${issue.details.exception.reason}\n`;
                        md += `  - 创建人: ${issue.details.exception.createdBy}\n`;
                        md += `  - 创建时间: ${(0, utils_1.formatDate)(issue.details.exception.createdAt)}\n`;
                        if (issue.details.exception.expiresAt) {
                            md += `  - 过期时间: ${(0, utils_1.formatDate)(issue.details.exception.expiresAt)} ❌ 已过期\n`;
                        }
                    }
                    md += '\n';
                }
            }
        }
        if (exceptions.active.length > 0 || exceptions.expired.length > 0) {
            md += '## 例外规则\n\n';
            if (exceptions.active.length > 0) {
                md += '### ✅ 生效中的例外规则\n\n';
                md += '| 路径 | 原因 | 创建人 | 创建时间 | 过期时间 |\n';
                md += '|------|------|--------|----------|----------|\n';
                for (const rule of exceptions.active) {
                    md += `| \`${rule.path}\` | ${rule.reason} | ${rule.createdBy} | ${(0, utils_1.formatDate)(rule.createdAt)} | ${rule.expiresAt ? (0, utils_1.formatDate)(rule.expiresAt) : '永不过期'} |\n`;
                }
                md += '\n';
            }
            if (exceptions.expired.length > 0) {
                md += '### ❌ 已过期的例外规则\n\n';
                md += '| 路径 | 原因 | 创建人 | 创建时间 | 过期时间 |\n';
                md += '|------|------|--------|----------|----------|\n';
                for (const rule of exceptions.expired) {
                    md += `| \`${rule.path}\` | ${rule.reason} | ${rule.createdBy} | ${(0, utils_1.formatDate)(rule.createdAt)} | ${(0, utils_1.formatDate)(rule.expiresAt)} |\n`;
                }
                md += '\n';
            }
        }
        md += '## 附录\n\n';
        md += `- 工具版本: ${metadata.version}\n`;
        md += `- 扫描命令参数:\n`;
        md += `  \`\`\`json\n  ${JSON.stringify(metadata.cliOptions, null, 2).split('\n').join('\n  ')}\n  \`\`\`\n`;
        return md;
    }
    getExitCode() {
        const { summary } = this.report;
        if (summary.expiredExceptions > 0) {
            return 4;
        }
        const hasLeaks = summary.criticalIssues > 0 || summary.highIssues > 0 || summary.mediumIssues > 0;
        if (hasLeaks && this.options.failOnLeak) {
            return 1;
        }
        return 0;
    }
}
exports.Reporter = Reporter;
function createReporter(report, options) {
    return new Reporter(report, options);
}
//# sourceMappingURL=reporter.js.map