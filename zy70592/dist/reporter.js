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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const table_1 = require("table");
class Reporter {
    constructor(result, outputDir) {
        this.result = result;
        this.outputDir = outputDir || process.cwd();
    }
    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    printConsoleSummary() {
        console.log('\n');
        console.log(chalk_1.default.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
        console.log(chalk_1.default.bold.blue('║           REST API 错误体一致性检查报告                        ║'));
        console.log(chalk_1.default.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
        console.log('\n');
        console.log(chalk_1.default.bold('📋 检查元数据'));
        console.log(chalk_1.default.gray('────────────────────────────────────────'));
        console.log(`  输入文件: ${chalk_1.default.cyan(this.result.metadata.inputFile)}`);
        console.log(`  检查时间: ${chalk_1.default.cyan(new Date(this.result.metadata.checkedAt).toLocaleString())}`);
        console.log(`  接口总数: ${chalk_1.default.cyan(this.result.metadata.totalEndpoints)}`);
        console.log(`  错误响应数: ${chalk_1.default.cyan(this.result.metadata.totalErrorResponses)}`);
        console.log('');
        console.log(chalk_1.default.bold('📊 问题摘要'));
        console.log(chalk_1.default.gray('────────────────────────────────────────'));
        const summaryData = [
            [chalk_1.default.red('错误'), chalk_1.default.yellow('警告'), chalk_1.default.blue('信息'), chalk_1.default.bold('总计')],
            [
                chalk_1.default.red(this.result.summary.errors),
                chalk_1.default.yellow(this.result.summary.warnings),
                chalk_1.default.blue(this.result.summary.infos),
                chalk_1.default.bold(this.result.summary.totalIssues),
            ],
        ];
        console.log((0, table_1.table)(summaryData, {
            header: {
                content: '问题统计',
                alignment: 'center',
            },
        }));
        if (this.result.statusCodeGroups.length > 0) {
            console.log(chalk_1.default.bold('🔍 状态码分组分析'));
            console.log(chalk_1.default.gray('────────────────────────────────────────'));
            const groupData = [
                [chalk_1.default.bold('状态码'), chalk_1.default.bold('分类'), chalk_1.default.bold('响应数'), chalk_1.default.bold('通用字段')],
                ...this.result.statusCodeGroups.map(group => [
                    group.statusCode,
                    group.category,
                    group.responses.length.toString(),
                    group.commonFields.length > 0 ? group.commonFields.join(', ') : chalk_1.default.gray('(无)'),
                ]),
            ];
            console.log((0, table_1.table)(groupData));
        }
        if (this.result.issues.length > 0) {
            console.log(chalk_1.default.bold('❌ 问题详情'));
            console.log(chalk_1.default.gray('────────────────────────────────────────'));
            for (const issue of this.result.issues) {
                const severityColor = issue.severity === 'error' ? chalk_1.default.red :
                    issue.severity === 'warning' ? chalk_1.default.yellow : chalk_1.default.blue;
                console.log(`\n  ${severityColor(`[${issue.severity.toUpperCase()}]`)} ${issue.message}`);
                console.log(`     位置: ${chalk_1.default.magenta(`${issue.location.method} ${issue.location.path}`)} ${chalk_1.default.gray(`[${issue.location.statusCode}]`)}`);
                if (issue.details.suggestion) {
                    console.log(`     建议: ${chalk_1.default.gray(issue.details.suggestion)}`);
                }
                if (issue.details.expected) {
                    console.log(`     期望字段: ${chalk_1.default.green(issue.details.expected.join(', '))}`);
                }
                if (issue.details.actual && issue.details.actual.length > 0) {
                    console.log(`     实际字段: ${chalk_1.default.dim(issue.details.actual.join(', '))}`);
                }
            }
        }
        if (this.result.recommendations.length > 0) {
            console.log('\n');
            console.log(chalk_1.default.bold('💡 改进建议'));
            console.log(chalk_1.default.gray('────────────────────────────────────────'));
            for (let i = 0; i < this.result.recommendations.length; i++) {
                console.log(`  ${i + 1}. ${this.result.recommendations[i]}`);
            }
        }
        console.log('\n');
        if (this.result.summary.errors > 0) {
            console.log(chalk_1.default.red.bold(`❌ 检查失败: 发现 ${this.result.summary.errors} 个错误`));
        }
        else if (this.result.summary.warnings > 0) {
            console.log(chalk_1.default.yellow.bold(`⚠️  检查完成: 发现 ${this.result.summary.warnings} 个警告`));
        }
        else {
            console.log(chalk_1.default.green.bold('✅ 检查通过: 所有错误响应体一致!'));
        }
        console.log('\n');
    }
    ensureParentDir(filePath) {
        const parentDir = path.dirname(filePath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }
    }
    writeJsonOutput(outputPath) {
        const filePath = outputPath || path.join(this.outputDir, 'error-consistency-report.json');
        this.ensureParentDir(filePath);
        const jsonContent = JSON.stringify(this.result, null, 2);
        fs.writeFileSync(filePath, jsonContent, 'utf-8');
        console.log(chalk_1.default.green(`✅ 机器可读报告已写入: ${filePath}`));
        return filePath;
    }
    writeMarkdownOutput(outputPath) {
        const filePath = outputPath || path.join(this.outputDir, 'error-consistency-report.md');
        this.ensureParentDir(filePath);
        const markdown = this.generateMarkdown();
        fs.writeFileSync(filePath, markdown, 'utf-8');
        console.log(chalk_1.default.green(`✅ Markdown 报告已写入: ${filePath}`));
        return filePath;
    }
    generateMarkdown() {
        let md = '# REST API 错误体一致性检查报告\n\n';
        md += '## 检查元数据\n\n';
        md += '| 项目 | 值 |\n';
        md += '|------|-----|\n';
        md += `| 输入文件 | \`${this.result.metadata.inputFile}\` |\n`;
        md += `| 检查时间 | ${new Date(this.result.metadata.checkedAt).toLocaleString()} |\n`;
        md += `| 接口总数 | ${this.result.metadata.totalEndpoints} |\n`;
        md += `| 错误响应数 | ${this.result.metadata.totalErrorResponses} |\n\n`;
        md += '## 问题摘要\n\n';
        md += '| 严重程度 | 数量 |\n';
        md += '|----------|------|\n';
        md += `| 🔴 错误 | ${this.result.summary.errors} |\n`;
        md += `| 🟡 警告 | ${this.result.summary.warnings} |\n`;
        md += `| 🔵 信息 | ${this.result.summary.infos} |\n`;
        md += `| **总计** | **${this.result.summary.totalIssues}** |\n\n`;
        if (this.result.statusCodeGroups.length > 0) {
            md += '## 状态码分组分析\n\n';
            md += '| 状态码 | 分类 | 响应数 | 通用字段 |\n';
            md += '|--------|------|--------|----------|\n';
            for (const group of this.result.statusCodeGroups) {
                md += `| ${group.statusCode} | ${group.category} | ${group.responses.length} | ${group.commonFields.length > 0 ? group.commonFields.join(', ') : '(无)'} |\n`;
            }
            md += '\n';
        }
        if (this.result.issues.length > 0) {
            md += '## 问题详情\n\n';
            const errors = this.result.issues.filter(i => i.severity === 'error');
            const warnings = this.result.issues.filter(i => i.severity === 'warning');
            const infos = this.result.issues.filter(i => i.severity === 'info');
            if (errors.length > 0) {
                md += '### 🔴 错误\n\n';
                for (const issue of errors) {
                    md += `#### ${issue.message}\n\n`;
                    md += `- **位置**: \`${issue.location.method} ${issue.location.path}\` [${issue.location.statusCode}]\n`;
                    if (issue.details.suggestion) {
                        md += `- **建议**: ${issue.details.suggestion}\n`;
                    }
                    if (issue.details.expected) {
                        md += `- **期望字段**: ${issue.details.expected.join(', ')}\n`;
                    }
                    if (issue.details.actual && issue.details.actual.length > 0) {
                        md += `- **实际字段**: ${issue.details.actual.join(', ')}\n`;
                    }
                    md += '\n';
                }
            }
            if (warnings.length > 0) {
                md += '### 🟡 警告\n\n';
                for (const issue of warnings) {
                    md += `#### ${issue.message}\n\n`;
                    md += `- **位置**: \`${issue.location.method} ${issue.location.path}\` [${issue.location.statusCode}]\n`;
                    if (issue.details.suggestion) {
                        md += `- **建议**: ${issue.details.suggestion}\n`;
                    }
                    md += '\n';
                }
            }
        }
        if (this.result.recommendations.length > 0) {
            md += '## 💡 改进建议\n\n';
            for (let i = 0; i < this.result.recommendations.length; i++) {
                md += `${i + 1}. ${this.result.recommendations[i]}\n`;
            }
            md += '\n';
        }
        md += '---\n\n';
        md += `*报告生成于: ${new Date().toLocaleString()}*\n`;
        return md;
    }
    generateAllReports(jsonPath, markdownPath) {
        this.printConsoleSummary();
        console.log('');
        this.writeJsonOutput(jsonPath);
        this.writeMarkdownOutput(markdownPath);
    }
}
exports.Reporter = Reporter;
