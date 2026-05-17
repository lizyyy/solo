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
exports.ReportGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
class ReportGenerator {
    generateTerminalReport(report) {
        const lines = [];
        lines.push(this.generateHeader());
        lines.push('');
        lines.push(this.generateSummarySection(report));
        lines.push('');
        if (report.differences.length > 0) {
            lines.push(this.generateDifferencesSection(report.differences));
            lines.push('');
        }
        if (report.badEntries.length > 0) {
            lines.push(this.generateBadEntriesSection(report.badEntries));
            lines.push('');
        }
        if (report.errors.length > 0) {
            lines.push(this.generateErrorsSection(report.errors));
            lines.push('');
        }
        lines.push(this.generateFooter(report));
        return lines.join('\n');
    }
    generateJsonReport(report) {
        return JSON.stringify(report, null, 2);
    }
    generateMarkdownReport(report) {
        const lines = [];
        lines.push('# API 枚举契约检查报告');
        lines.push('');
        lines.push(`**生成时间**: ${report.timestamp.toLocaleString()}`);
        lines.push('');
        lines.push('## 📊 概览');
        lines.push('');
        lines.push('| 指标 | 数值 |');
        lines.push('|------|------|');
        lines.push(`| 总枚举数 | ${report.summary.totalEnums} |`);
        lines.push(`| ✅ 匹配枚举 | ${report.summary.matchedEnums} |`);
        lines.push(`| ❌ 不匹配枚举 | ${report.summary.mismatchedEnums} |`);
        lines.push(`| ⚠️  异常条目 | ${report.summary.totalBadEntries} |`);
        lines.push(`| ❌ 处理错误 | ${report.summary.errors} |`);
        lines.push('');
        lines.push('## 📁 扫描文件');
        lines.push('');
        lines.push('### OpenAPI 文件');
        lines.push('');
        report.metadata.openApiFiles.forEach(f => lines.push(`- \`${f}\``));
        lines.push('');
        lines.push('### 源代码文件');
        lines.push('');
        report.metadata.sourceFiles.forEach(f => lines.push(`- \`${f}\``));
        lines.push('');
        if (report.differences.length > 0) {
            lines.push('## 🔍 枚举差异');
            lines.push('');
            for (const diff of report.differences) {
                lines.push(`### 📌 ${diff.enumName}`);
                lines.push('');
                if (diff.onlyInOpenApi.length > 0) {
                    lines.push('#### ❌ 仅在 OpenAPI 文档中存在');
                    lines.push('');
                    diff.onlyInOpenApi.forEach(v => {
                        const location = v.line ? ` (行 ${v.line}${v.column ? `, 列 ${v.column}` : ''})` : '';
                        lines.push(`- \`${v.value}\`${location}`);
                    });
                    lines.push('');
                }
                if (diff.onlyInSource.length > 0) {
                    lines.push('#### ❌ 仅在源代码中存在');
                    lines.push('');
                    diff.onlyInSource.forEach(v => {
                        const location = v.line ? ` (行 ${v.line}${v.column ? `, 列 ${v.column}` : ''})` : '';
                        lines.push(`- \`${v.value}\`${location}`);
                    });
                    lines.push('');
                }
            }
        }
        if (report.badEntries.length > 0) {
            lines.push('## ⚠️  异常条目');
            lines.push('');
            for (const entry of report.badEntries) {
                const location = entry.line ? `行 ${entry.line}${entry.column ? `, 列 ${entry.column}` : ''}` : '未知位置';
                const severity = entry.severity === 'error' ? '🔴' : '🟡';
                lines.push(`### ${severity} ${path.basename(entry.filePath)} - ${location}`);
                lines.push('');
                lines.push(`**原因**: ${entry.reason}`);
                lines.push('');
                if (entry.rawContent) {
                    lines.push('**原始内容**:');
                    lines.push('```');
                    lines.push(entry.rawContent.substring(0, 200));
                    if (entry.rawContent.length > 200)
                        lines.push('...');
                    lines.push('```');
                }
                lines.push('');
            }
        }
        if (report.errors.length > 0) {
            lines.push('## ❌ 处理错误');
            lines.push('');
            for (const error of report.errors) {
                lines.push(`### 📄 ${path.basename(error.filePath)}`);
                lines.push('');
                lines.push(`**错误**: ${error.error}`);
                lines.push('');
            }
        }
        lines.push('---');
        lines.push('');
        lines.push('*此报告由 API Enum CLI 自动生成*');
        return lines.join('\n');
    }
    saveReport(report, outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, report, 'utf-8');
    }
    generateHeader() {
        return chalk_1.default.bold.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                    API 枚举契约检查工具                        ║
║                    API Enum Contract Checker                  ║
╚══════════════════════════════════════════════════════════════╝
`);
    }
    generateSummarySection(report) {
        const table = new cli_table3_1.default({
            head: [
                chalk_1.default.bold('指标'),
                chalk_1.default.bold('数值'),
                chalk_1.default.bold('状态')
            ],
            colWidths: [20, 15, 15]
        });
        table.push(['总枚举数', report.summary.totalEnums.toString(), ''], ['匹配枚举', report.summary.matchedEnums.toString(), chalk_1.default.green('✅')], ['不匹配枚举', report.summary.mismatchedEnums.toString(), report.summary.mismatchedEnums > 0 ? chalk_1.default.red('❌') : ''], ['异常条目', report.summary.totalBadEntries.toString(), report.summary.totalBadEntries > 0 ? chalk_1.default.yellow('⚠️') : ''], ['处理错误', report.summary.errors.toString(), report.summary.errors > 0 ? chalk_1.default.red('❌') : '']);
        return chalk_1.default.bold('📊 检查概览\n') + table.toString();
    }
    generateDifferencesSection(differences) {
        const lines = [];
        lines.push(chalk_1.default.bold('🔍 枚举差异详情'));
        lines.push('');
        for (const diff of differences) {
            lines.push(chalk_1.default.bold.yellow(`📌 ${diff.enumName}`));
            if (diff.onlyInOpenApi.length > 0) {
                lines.push('');
                lines.push(chalk_1.default.red('   ❌ 仅在 OpenAPI 文档中存在:'));
                diff.onlyInOpenApi.forEach(v => {
                    const location = v.line ? ` (行 ${v.line})` : '';
                    lines.push(chalk_1.default.red(`      • ${v.value}${location}`));
                });
            }
            if (diff.onlyInSource.length > 0) {
                lines.push('');
                lines.push(chalk_1.default.magenta('   ❌ 仅在源代码中存在:'));
                diff.onlyInSource.forEach(v => {
                    const location = v.line ? ` (行 ${v.line})` : '';
                    lines.push(chalk_1.default.magenta(`      • ${v.value}${location}`));
                });
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    generateBadEntriesSection(badEntries) {
        const lines = [];
        lines.push(chalk_1.default.bold('⚠️  异常条目详情'));
        lines.push('');
        for (const entry of badEntries) {
            const severity = entry.severity === 'error' ? chalk_1.default.red('🔴') : chalk_1.default.yellow('🟡');
            const location = entry.line ? `行 ${entry.line}${entry.column ? `, 列 ${entry.column}` : ''}` : '未知位置';
            lines.push(`${severity} ${chalk_1.default.bold(path.basename(entry.filePath))} - ${location}`);
            lines.push(chalk_1.default.gray(`   原因: ${entry.reason}`));
            if (entry.rawContent) {
                lines.push(chalk_1.default.gray(`   内容: ${entry.rawContent.substring(0, 80)}${entry.rawContent.length > 80 ? '...' : ''}`));
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    generateErrorsSection(errors) {
        const lines = [];
        lines.push(chalk_1.default.bold('❌ 处理错误详情'));
        lines.push('');
        for (const error of errors) {
            lines.push(chalk_1.default.red(`   📄 ${path.basename(error.filePath)}`));
            lines.push(chalk_1.default.red(`      ${error.error}`));
            lines.push('');
        }
        return lines.join('\n');
    }
    generateFooter(report) {
        const hasIssues = report.summary.mismatchedEnums > 0 || report.summary.errors > 0;
        const status = hasIssues ? chalk_1.default.red('❌ 检查失败 - 存在差异或错误') : chalk_1.default.green('✅ 检查通过 - 所有枚举一致');
        return `
${chalk_1.default.bold('══════════════════════════════════════════════════════════════')}
${status}
${chalk_1.default.gray(`生成时间: ${report.timestamp.toLocaleString()}`)}
${chalk_1.default.bold('══════════════════════════════════════════════════════════════')}
`;
    }
    getExitCode(report, failOnError) {
        if (!failOnError) {
            return 0;
        }
        return report.summary.mismatchedEnums > 0 || report.summary.errors > 0 ? 1 : 0;
    }
}
exports.ReportGenerator = ReportGenerator;
