"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.printTerminalSummary = printTerminalSummary;
exports.generateJSONReport = generateJSONReport;
exports.generateMarkdownReport = generateMarkdownReport;
exports.exportReports = exportReports;
const fs_1 = require("fs");
const chalk_1 = __importDefault(require("chalk"));
const Table = require("cli-table3");
function printTerminalSummary(result) {
    console.log('\n' + chalk_1.default.bold.blue('='.repeat(60)));
    console.log(chalk_1.default.bold.blue('           GraphQL 字段用量分析报告'));
    console.log(chalk_1.default.bold.blue('='.repeat(60)) + '\n');
    console.log(chalk_1.default.bold('📊 概览统计'));
    console.log(`  总查询数: ${result.totalQueries}`);
    console.log(`  成功解析: ${chalk_1.default.green(result.successfulQueries)}`);
    console.log(`  解析失败: ${chalk_1.default.red(result.failedQueries)}\n`);
    if (Object.keys(result.clientStats).length > 0) {
        console.log(chalk_1.default.bold('👥 客户端分布'));
        const clientTable = new Table({
            head: ['客户端', '查询数量'],
            colWidths: [40, 15]
        });
        for (const [client, count] of Object.entries(result.clientStats)) {
            clientTable.push([client, count.toString()]);
        }
        console.log(clientTable.toString() + '\n');
    }
    console.log(chalk_1.default.bold('🔝 字段使用排名 (Top 20)'));
    const topFields = result.fieldUsage.slice(0, 20);
    const fieldTable = new Table({
        head: ['字段路径', '使用次数'],
        colWidths: [45, 15]
    });
    for (const field of topFields) {
        fieldTable.push([field.fullPath, field.count.toString()]);
    }
    console.log(fieldTable.toString() + '\n');
    if (result.fieldUsage.length > 20) {
        console.log(chalk_1.default.gray(`  ... 还有 ${result.fieldUsage.length - 20} 个字段\n`));
    }
    if (result.errors.length > 0) {
        console.log(chalk_1.default.bold.yellow('⚠️  错误详情'));
        for (const error of result.errors) {
            const location = error.source
                ? `${error.source}:${error.lineNumber || '?'}`
                : '位置未知';
            console.log(`  ${chalk_1.default.yellow(location)}: ${error.message}`);
        }
        console.log('');
    }
    console.log(chalk_1.default.bold.green('✅ 分析完成!'));
    console.log(chalk_1.default.gray('  使用 --output 导出完整报告\n'));
}
function generateJSONReport(result) {
    return JSON.stringify(result, null, 2);
}
function generateMarkdownReport(result, schemaPath, queriesPath) {
    const date = new Date().toISOString().split('T')[0];
    let md = `# GraphQL 字段用量分析报告\n\n`;
    md += `> 生成日期: ${date}\n`;
    md += `> Schema文件: \`${schemaPath}\`\n`;
    md += `> 查询样本: \`${queriesPath}\`\n\n`;
    md += `## 📊 概览统计\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总查询数 | ${result.totalQueries} |\n`;
    md += `| 成功解析 | ${result.successfulQueries} |\n`;
    md += `| 解析失败 | ${result.failedQueries} |\n\n`;
    if (Object.keys(result.clientStats).length > 0) {
        md += `## 👥 客户端分布\n\n`;
        md += `| 客户端 | 查询数量 |\n`;
        md += `|--------|----------|\n`;
        for (const [client, count] of Object.entries(result.clientStats).sort((a, b) => b[1] - a[1])) {
            md += `| ${client} | ${count} |\n`;
        }
        md += `\n`;
    }
    md += `## 🔝 字段使用排名\n\n`;
    md += `| 排名 | 字段路径 | 使用次数 | 客户端 |\n`;
    md += `|------|----------|----------|--------|\n`;
    result.fieldUsage.slice(0, 50).forEach((field, index) => {
        const clientList = Object.entries(field.clients)
            .sort((a, b) => b[1] - a[1])
            .map(([c, n]) => `${c}(${n})`)
            .join(', ');
        md += `| ${index + 1} | \`${field.fullPath}\` | ${field.count} | ${clientList} |\n`;
    });
    md += `\n`;
    if (result.fieldUsage.length > 50) {
        md += `> 仅显示前 50 个字段，完整列表请查看 JSON 输出\n\n`;
    }
    if (result.errors.length > 0) {
        md += `## ⚠️  错误详情\n\n`;
        md += `| 位置 | 错误信息 | 原始内容 |\n`;
        md += `|------|----------|----------|\n`;
        for (const error of result.errors) {
            const location = error.source
                ? `${error.source}:${error.lineNumber || '?'}`
                : '位置未知';
            const rawContent = (error.rawContent || error.query || '')
                .replace(/\n/g, ' ')
                .substring(0, 100);
            md += `| ${location} | ${error.message} | \`${rawContent}\` |\n`;
        }
        md += `\n`;
    }
    md += `## 💡 操作建议\n\n`;
    md += `- **高频字段**: 请谨慎修改，确保向后兼容\n`;
    md += `- **零使用字段**: 可考虑标记为 @deprecated 或安排删除\n`;
    md += `- **错误查询**: 请修复或移除无效的查询样本\n\n`;
    return md;
}
function exportReports(result, outputPath, format, schemaPath, queriesPath) {
    if (format === 'json' || format === 'both') {
        const jsonContent = generateJSONReport(result);
        (0, fs_1.writeFileSync)(`${outputPath}.json`, jsonContent);
        console.log(chalk_1.default.green(`  ✓ JSON报告已导出: ${outputPath}.json`));
    }
    if (format === 'markdown' || format === 'both') {
        const mdContent = generateMarkdownReport(result, schemaPath, queriesPath);
        (0, fs_1.writeFileSync)(`${outputPath}.md`, mdContent);
        console.log(chalk_1.default.green(`  ✓ Markdown报告已导出: ${outputPath}.md`));
    }
}
