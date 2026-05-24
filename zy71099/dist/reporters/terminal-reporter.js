"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalReporter = void 0;
const chalk_1 = __importDefault(require("chalk"));
const base_reporter_1 = require("./base-reporter");
const severityColors = {
    error: chalk_1.default.red,
    warning: chalk_1.default.yellow,
    info: chalk_1.default.blue
};
const diffTypeLabels = {
    request_missing: '请求缺失',
    request_added: '新增请求',
    request_method: '方法不匹配',
    request_url: 'URL不匹配',
    request_header: '请求头差异',
    request_body: '请求体差异',
    request_query: '查询参数差异',
    response_status: '状态码差异',
    response_header: '响应头差异',
    response_body: '响应体差异',
    masking_mismatch: '脱敏问题',
    unmatched: '未匹配'
};
class TerminalReporter extends base_reporter_1.BaseReporter {
    constructor(result, outputDir, expectedFile, actualFile, verbose = false) {
        super(result, outputDir, expectedFile, actualFile);
        this.verbose = verbose;
    }
    generate() {
        const lines = [];
        lines.push(this.generateHeader());
        lines.push('');
        lines.push(this.generateSummary());
        lines.push('');
        if (this.result.differences.length > 0) {
            lines.push(this.generateDifferences());
            lines.push('');
        }
        lines.push(this.generateExitCodeInfo());
        return lines.join('\n');
    }
    generateHeader() {
        const title = chalk_1.default.bold.cyan('═'.repeat(60));
        const header = chalk_1.default.bold.cyan('  API Cassette 差异报告');
        const time = chalk_1.default.gray(`  生成时间: ${new Date(this.result.generatedAt).toLocaleString('zh-CN')}`);
        return [title, header, time, title].join('\n');
    }
    generateSummary() {
        const { summary } = this.result;
        const lines = [];
        lines.push(chalk_1.default.bold('📊 比较摘要'));
        lines.push('');
        const expPath = this.getRelativePath(this.expectedFile);
        const actPath = this.getRelativePath(this.actualFile);
        lines.push(`  期望文件: ${chalk_1.default.cyan(expPath)}`);
        lines.push(`  实际文件: ${chalk_1.default.cyan(actPath)}`);
        lines.push('');
        const items = [
            { label: '期望请求数', value: summary.totalInteractions.expected },
            { label: '实际请求数', value: summary.totalInteractions.actual },
            { label: '匹配成功', value: summary.matched, color: chalk_1.default.green },
            { label: '新增请求', value: summary.added, color: chalk_1.default.yellow },
            { label: '缺失请求', value: summary.removed, color: chalk_1.default.red },
            { label: '内容变更', value: summary.changed, color: chalk_1.default.magenta },
        ];
        for (const item of items) {
            const colorFn = item.color || chalk_1.default.white;
            lines.push(`  ${item.label.padEnd(12)}: ${colorFn(String(item.value))}`);
        }
        lines.push('');
        if (summary.errors > 0) {
            lines.push(`  ${chalk_1.default.red(`❌ 错误: ${summary.errors}`)}`);
        }
        if (summary.warnings > 0) {
            lines.push(`  ${chalk_1.default.yellow(`⚠️  警告: ${summary.warnings}`)}`);
        }
        if (summary.errors === 0 && summary.warnings === 0) {
            lines.push(`  ${chalk_1.default.green('✅ 未发现差异')}`);
        }
        return lines.join('\n');
    }
    generateDifferences() {
        const lines = [];
        const groupedDiffs = this.groupBySeverity();
        lines.push(chalk_1.default.bold('🔍 差异详情'));
        lines.push('');
        for (const severity of ['error', 'warning', 'info']) {
            const diffs = groupedDiffs[severity];
            if (diffs.length === 0)
                continue;
            const color = severityColors[severity];
            const label = severity === 'error' ? '❌ 错误' : severity === 'warning' ? '⚠️  警告' : 'ℹ️  信息';
            lines.push(color(`  ${label} (${diffs.length})`));
            lines.push('');
            for (const diff of diffs) {
                lines.push(this.formatDiff(diff));
                lines.push('');
            }
        }
        return lines.join('\n');
    }
    groupBySeverity() {
        const groups = {
            error: [],
            warning: [],
            info: []
        };
        for (const diff of this.result.differences) {
            groups[diff.severity].push(diff);
        }
        return groups;
    }
    formatDiff(diff) {
        const color = severityColors[diff.severity];
        const typeLabel = diffTypeLabels[diff.type] || diff.type;
        const lines = [];
        lines.push(`    ${color('●')} ${chalk_1.default.bold(typeLabel)}`);
        lines.push(`       ${diff.message}`);
        if (diff.expectedSource?.file) {
            lines.push(`       期望: ${chalk_1.default.gray(this.formatSourceLink(diff.expectedSource.file, diff.expectedSource.line))}`);
        }
        if (diff.actualSource?.file) {
            lines.push(`       实际: ${chalk_1.default.gray(this.formatSourceLink(diff.actualSource.file, diff.actualSource.line))}`);
        }
        if (this.verbose && diff.details.length > 0) {
            lines.push('');
            lines.push('       详细差异:');
            for (const detail of diff.details.slice(0, 10)) {
                const path = chalk_1.default.cyan(detail.path);
                if (detail.type === 'added') {
                    lines.push(`         ${chalk_1.default.green('+')} ${path}: ${JSON.stringify(detail.actual)}`);
                }
                else if (detail.type === 'removed') {
                    lines.push(`         ${chalk_1.default.red('-')} ${path}: ${JSON.stringify(detail.expected)}`);
                }
                else {
                    lines.push(`         ${chalk_1.default.yellow('~')} ${path}:`);
                    lines.push(`           期望: ${JSON.stringify(detail.expected)}`);
                    lines.push(`           实际: ${JSON.stringify(detail.actual)}`);
                }
            }
            if (diff.details.length > 10) {
                lines.push(`         ... 还有 ${diff.details.length - 10} 项差异`);
            }
        }
        return lines.join('\n');
    }
    generateExitCodeInfo() {
        const explanation = this.getExitCodeExplanation();
        const lines = [];
        lines.push(chalk_1.default.bold('📋 退出码信息'));
        lines.push('');
        lines.push(`  退出码: ${chalk_1.default.bold(String(explanation.code))} (${explanation.name})`);
        lines.push(`  说明: ${explanation.description}`);
        lines.push(`  建议: ${chalk_1.default.italic(explanation.action)}`);
        return lines.join('\n');
    }
}
exports.TerminalReporter = TerminalReporter;
//# sourceMappingURL=terminal-reporter.js.map