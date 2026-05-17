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
    constructor(result) {
        this.result = result;
    }
    printTerminalSummary() {
        console.log('\n');
        console.log(chalk_1.default.bold.blue('='.repeat(70)));
        console.log(chalk_1.default.bold.blue('        REST 分页一致性检查报告'));
        console.log(chalk_1.default.bold.blue('='.repeat(70)));
        console.log('\n');
        this.printSummaryStats();
        this.printInconsistencySummary();
        this.printInconsistencyDetails();
        this.printBadEndpoints();
        console.log('\n');
        console.log(chalk_1.default.gray(`检查时间: ${new Date(this.result.timestamp).toLocaleString()}`));
        console.log(chalk_1.default.gray(`OpenAPI 文件: ${this.result.openapiFile}`));
        console.log('\n');
    }
    printSummaryStats() {
        const { summary } = this.result;
        console.log(chalk_1.default.bold('📊 概览统计'));
        console.log(chalk_1.default.gray('-'.repeat(70)));
        const statsData = [
            ['总接口数', summary.totalEndpoints.toString()],
            ['分页接口数', summary.paginationEndpoints.toString()],
            ['存在问题的接口数', chalk_1.default.red(summary.inconsistentEndpoints.toString())],
            ['总问题数 (Errors)', chalk_1.default.red(summary.bySeverity.error.toString())],
            ['警告数 (Warnings)', chalk_1.default.yellow(summary.bySeverity.warning.toString())],
            ['提示数 (Info)', chalk_1.default.blue(summary.bySeverity.info.toString())]
        ];
        console.log((0, table_1.table)(statsData, {
            columns: [{ width: 25 }, { width: 40 }],
            drawHorizontalLine: (index) => index === 0 || index === statsData.length
        }));
    }
    printInconsistencySummary() {
        const errors = this.result.inconsistencies.filter(i => i.severity === 'error');
        const warnings = this.result.inconsistencies.filter(i => i.severity === 'warning');
        const infos = this.result.inconsistencies.filter(i => i.severity === 'info');
        if (errors.length === 0 && warnings.length === 0 && infos.length === 0) {
            console.log(chalk_1.default.green('✅ 所有分页接口规范一致！\n'));
            return;
        }
        console.log(chalk_1.default.bold('📝 问题类型分布'));
        console.log(chalk_1.default.gray('-'.repeat(70)));
        const typeCounts = {};
        for (const inc of this.result.inconsistencies) {
            typeCounts[inc.type] = (typeCounts[inc.type] || 0) + 1;
        }
        const typeData = Object.entries(typeCounts).map(([type, count]) => {
            const typeName = this.getTypeName(type);
            return [typeName, count.toString()];
        });
        console.log((0, table_1.table)(typeData, {
            columns: [{ width: 30 }, { width: 35 }],
            drawHorizontalLine: (index) => index === 0 || index === typeData.length
        }));
    }
    getTypeName(type) {
        const names = {
            param_missing: '缺少分页参数',
            param_name: '参数命名不一致',
            response_missing: '缺少响应字段',
            response_name: '响应字段命名不一致',
            structure_issue: '结构问题'
        };
        return names[type] || type;
    }
    printInconsistencyDetails() {
        const errors = this.result.inconsistencies.filter(i => i.severity === 'error');
        if (errors.length === 0)
            return;
        console.log(chalk_1.default.bold.red('❌ 严重问题详情'));
        console.log(chalk_1.default.gray('-'.repeat(70)));
        for (const inc of errors) {
            this.printInconsistency(inc);
        }
    }
    printInconsistency(inc) {
        const location = `${inc.location.method} ${inc.location.path}`;
        const severityColor = inc.severity === 'error' ? chalk_1.default.red :
            inc.severity === 'warning' ? chalk_1.default.yellow : chalk_1.default.blue;
        console.log(`\n${severityColor('●')} ${inc.message}`);
        console.log(chalk_1.default.gray(`  位置: ${location}`));
        if (inc.location.paramName) {
            console.log(chalk_1.default.gray(`  参数: ${inc.location.paramName}`));
        }
        if (inc.location.fieldName) {
            console.log(chalk_1.default.gray(`  字段: ${inc.location.fieldName}`));
        }
        if (inc.expected) {
            console.log(chalk_1.default.gray(`  期望: ${inc.expected.join(', ')}`));
        }
        if (inc.actual) {
            console.log(chalk_1.default.gray(`  实际: ${inc.actual}`));
        }
        if (inc.suggestion) {
            console.log(chalk_1.default.green(`  💡 建议: ${inc.suggestion}`));
        }
    }
    printBadEndpoints() {
        const badEndpoints = this.result.endpoints.filter(e => e.inconsistencies.some(i => i.severity === 'error'));
        if (badEndpoints.length === 0)
            return;
        console.log('\n');
        console.log(chalk_1.default.bold.red('🔴 需要修复的接口列表'));
        console.log(chalk_1.default.gray('-'.repeat(70)));
        const endpointData = badEndpoints.map(e => [
            `${e.method} ${e.path}`,
            e.inconsistencies.filter(i => i.severity === 'error').length.toString(),
            e.inconsistencies.filter(i => i.severity === 'warning').length.toString()
        ]);
        endpointData.unshift([chalk_1.default.bold('接口'), chalk_1.default.bold('错误数'), chalk_1.default.bold('警告数')]);
        console.log((0, table_1.table)(endpointData, {
            columns: [{ width: 40 }, { width: 10 }, { width: 10 }],
            drawHorizontalLine: (index) => index === 0 || index === 1 || index === endpointData.length
        }));
    }
    exportJSON(outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(this.result, null, 2), 'utf-8');
        console.log(chalk_1.default.green(`✅ JSON 报告已导出: ${outputPath}`));
    }
    exportMarkdown(outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const markdown = this.generateMarkdown();
        fs.writeFileSync(outputPath, markdown, 'utf-8');
        console.log(chalk_1.default.green(`✅ Markdown 报告已导出: ${outputPath}`));
    }
    generateMarkdown() {
        const lines = [];
        lines.push('# REST 分页一致性检查报告');
        lines.push('');
        lines.push(`**生成时间**: ${new Date(this.result.timestamp).toLocaleString()}`);
        lines.push(`**OpenAPI 文件**: \`${this.result.openapiFile}\``);
        lines.push('');
        lines.push('## 📊 概览统计');
        lines.push('');
        lines.push('| 指标 | 数值 |');
        lines.push('|------|------|');
        lines.push(`| 总接口数 | ${this.result.summary.totalEndpoints} |`);
        lines.push(`| 分页接口数 | ${this.result.summary.paginationEndpoints} |`);
        lines.push(`| 存在问题的接口数 | **${this.result.summary.inconsistentEndpoints}** |`);
        lines.push(`| 严重错误数 | 🔴 ${this.result.summary.bySeverity.error} |`);
        lines.push(`| 警告数 | 🟡 ${this.result.summary.bySeverity.warning} |`);
        lines.push(`| 提示数 | 🔵 ${this.result.summary.bySeverity.info} |`);
        lines.push('');
        if (this.result.summary.totalInconsistencies === 0 &&
            this.result.summary.bySeverity.warning === 0) {
            lines.push('## ✅ 检查通过');
            lines.push('');
            lines.push('所有分页接口规范一致！');
            lines.push('');
        }
        else {
            lines.push('## 🔴 严重问题详情');
            lines.push('');
            const errors = this.result.inconsistencies.filter(i => i.severity === 'error');
            if (errors.length > 0) {
                for (const inc of errors) {
                    lines.push(...this.formatInconsistencyMarkdown(inc));
                }
            }
            else {
                lines.push('无严重错误');
            }
            lines.push('');
            const warnings = this.result.inconsistencies.filter(i => i.severity === 'warning');
            if (warnings.length > 0) {
                lines.push('## 🟡 警告详情');
                lines.push('');
                for (const inc of warnings) {
                    lines.push(...this.formatInconsistencyMarkdown(inc));
                }
                lines.push('');
            }
            const badEndpoints = this.result.endpoints.filter(e => e.inconsistencies.some(i => i.severity === 'error'));
            if (badEndpoints.length > 0) {
                lines.push('## 📋 需要修复的接口列表');
                lines.push('');
                lines.push('| 接口 | 错误数 | 警告数 | 问题描述 |');
                lines.push('|------|--------|--------|----------|');
                for (const endpoint of badEndpoints) {
                    const errorCount = endpoint.inconsistencies.filter(i => i.severity === 'error').length;
                    const warningCount = endpoint.inconsistencies.filter(i => i.severity === 'warning').length;
                    const issues = endpoint.inconsistencies
                        .filter(i => i.severity === 'error')
                        .map(i => i.message)
                        .join('; ');
                    lines.push(`| \`${endpoint.method} ${endpoint.path}\` | ${errorCount} | ${warningCount} | ${issues} |`);
                }
                lines.push('');
            }
        }
        lines.push('## 📑 所有分页接口详情');
        lines.push('');
        lines.push('| 接口 | 分页参数 | 响应字段 | 状态 |');
        lines.push('|------|----------|----------|------|');
        for (const endpoint of this.result.endpoints.filter(e => e.isPaginationEndpoint)) {
            const params = [
                endpoint.paginationParams.page,
                endpoint.paginationParams.pageSize
            ].filter(Boolean).join(', ');
            const fields = [
                endpoint.responseFields.data,
                endpoint.responseFields.total
            ].filter(Boolean).join(', ');
            const hasError = endpoint.inconsistencies.some(i => i.severity === 'error');
            const hasWarning = endpoint.inconsistencies.some(i => i.severity === 'warning');
            const status = hasError ? '🔴 有错误' : hasWarning ? '🟡 有警告' : '✅ 正常';
            lines.push(`| \`${endpoint.method} ${endpoint.path}\` | \`${params || '-'}\` | \`${fields || '-'}\` | ${status} |`);
        }
        lines.push('');
        lines.push('## ⚙️ 检查配置');
        lines.push('');
        lines.push('### 期望的分页参数命名');
        lines.push(`- 页码: \`${this.result.config.expectedParams.page.join('`, `')}\``);
        lines.push(`- 页大小: \`${this.result.config.expectedParams.pageSize.join('`, `')}\``);
        lines.push('');
        lines.push('### 期望的响应字段命名');
        lines.push(`- 数据列表: \`${this.result.config.expectedResponseFields.data.join('`, `')}\``);
        lines.push(`- 总数: \`${this.result.config.expectedResponseFields.total.join('`, `')}\``);
        lines.push(`- 页码: \`${this.result.config.expectedResponseFields.page.join('`, `')}\``);
        lines.push(`- 页大小: \`${this.result.config.expectedResponseFields.pageSize.join('`, `')}\``);
        if (this.result.config.expectedResponseFields.totalPages) {
            lines.push(`- 总页数: \`${this.result.config.expectedResponseFields.totalPages.join('`, `')}\``);
        }
        lines.push('');
        return lines.join('\n');
    }
    formatInconsistencyMarkdown(inc) {
        const lines = [];
        const location = `\`${inc.location.method} ${inc.location.path}\``;
        const severityEmoji = inc.severity === 'error' ? '🔴' :
            inc.severity === 'warning' ? '🟡' : '🔵';
        lines.push(`### ${severityEmoji} ${inc.message}`);
        lines.push('');
        lines.push(`- **位置**: ${location}`);
        if (inc.location.paramName) {
            lines.push(`- **参数**: \`${inc.location.paramName}\``);
        }
        if (inc.location.fieldName) {
            lines.push(`- **字段**: \`${inc.location.fieldName}\``);
        }
        if (inc.expected) {
            lines.push(`- **期望命名**: \`${inc.expected.join('`, `')}\``);
        }
        if (inc.actual) {
            lines.push(`- **实际命名**: \`${inc.actual}\``);
        }
        if (inc.suggestion) {
            lines.push(`- **建议**: ${inc.suggestion}`);
        }
        lines.push('');
        return lines;
    }
    hasErrors() {
        return this.result.summary.bySeverity.error > 0;
    }
}
exports.Reporter = Reporter;
//# sourceMappingURL=reporter.js.map