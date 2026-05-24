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
exports.OutputHandler = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const types_1 = require("../types");
class OutputHandler {
    constructor(outputDir) {
        this.outputDir = outputDir;
        this.ensureOutputDir();
    }
    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    printConsoleSummary(records, report) {
        console.log('\n' + chalk_1.default.cyan('='.repeat(60)));
        console.log(chalk_1.default.cyan.bold('📧 邮件退信分析报告'));
        console.log(chalk_1.default.cyan('='.repeat(60)) + '\n');
        console.log(chalk_1.default.yellow.bold('📊 总体统计'));
        console.log(chalk_1.default.gray('-'.repeat(40)));
        console.log(`  总退信数: ${chalk_1.default.white.bold(report.totalRecords)}`);
        console.log(`  唯一收件人: ${chalk_1.default.white.bold(report.uniqueRecipients)}`);
        console.log(`  批次数量: ${chalk_1.default.white.bold(Object.keys(report.batches).length)}`);
        console.log('');
        console.log(chalk_1.default.yellow.bold('🏷️  退信分类统计'));
        console.log(chalk_1.default.gray('-'.repeat(40)));
        const categoryColors = {
            [types_1.BounceCategory.MAILBOX_NOT_EXIST]: chalk_1.default.red,
            [types_1.BounceCategory.POLICY_REJECTION]: chalk_1.default.yellow,
            [types_1.BounceCategory.CONTENT_BLOCKED]: chalk_1.default.magenta,
            [types_1.BounceCategory.TEMPORARY_FAILURE]: chalk_1.default.blue,
            [types_1.BounceCategory.UNKNOWN]: chalk_1.default.gray
        };
        for (const [category, count] of Object.entries(report.overallBreakdown)) {
            const cat = category;
            const color = categoryColors[cat];
            const percentage = report.totalRecords > 0
                ? ((count / report.totalRecords) * 100).toFixed(1)
                : '0.0';
            console.log(`  ${color(types_1.BounceCategoryLabels[cat])}: ${chalk_1.default.white.bold(count)} (${percentage}%)`);
        }
        console.log('');
        console.log(chalk_1.default.yellow.bold('💡 关键建议'));
        console.log(chalk_1.default.gray('-'.repeat(40)));
        for (const [index, recommendation] of report.recommendations.entries()) {
            console.log(`  ${index + 1}. ${recommendation}`);
        }
        console.log('');
        if (report.topReasons.length > 0) {
            console.log(chalk_1.default.yellow.bold('🔝 Top 5 退信原因'));
            console.log(chalk_1.default.gray('-'.repeat(40)));
            for (let i = 0; i < Math.min(5, report.topReasons.length); i++) {
                const reason = report.topReasons[i];
                console.log(`  ${i + 1}. ${chalk_1.default.cyan(reason.reason)}: ${chalk_1.default.white.bold(reason.count)} 次`);
            }
            console.log('');
        }
        if (Object.keys(report.batches).length > 1) {
            console.log(chalk_1.default.yellow.bold('📦 各批次统计'));
            console.log(chalk_1.default.gray('-'.repeat(40)));
            for (const [batchId, batch] of Object.entries(report.batches)) {
                const shortId = batchId.length > 20 ? batchId.substring(0, 17) + '...' : batchId;
                console.log(`  ${chalk_1.default.blue(shortId)}: ${batch.totalBounces} 封退信`);
            }
            console.log('');
        }
        const timestamp = new Date(report.generatedAt).toLocaleString('zh-CN');
        console.log(chalk_1.default.gray(`报告生成时间: ${timestamp}`));
        console.log(chalk_1.default.cyan('='.repeat(60)) + '\n');
    }
    writeJsonReport(report, filename = 'report.json') {
        const filePath = path.join(this.outputDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
        return filePath;
    }
    writeMarkdownReport(report, records, filename = 'report.md') {
        const filePath = path.join(this.outputDir, filename);
        const content = this.generateMarkdownContent(report, records);
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    generateMarkdownContent(report, records) {
        const timestamp = new Date(report.generatedAt).toLocaleString('zh-CN');
        let content = `# 邮件退信分析报告\n\n`;
        content += `> 生成时间: ${timestamp}\n\n`;
        content += `## 📊 总体统计\n\n`;
        content += `| 指标 | 数值 |\n`;
        content += `|------|------|\n`;
        content += `| 总退信数 | ${report.totalRecords} |\n`;
        content += `| 唯一收件人 | ${report.uniqueRecipients} |\n`;
        content += `| 批次数量 | ${Object.keys(report.batches).length} |\n\n`;
        content += `## 🏷️ 退信分类统计\n\n`;
        content += `| 分类 | 数量 | 占比 |\n`;
        content += `|------|------|------|\n`;
        for (const [category, count] of Object.entries(report.overallBreakdown)) {
            const cat = category;
            const percentage = report.totalRecords > 0
                ? ((count / report.totalRecords) * 100).toFixed(1)
                : '0.0';
            content += `| ${types_1.BounceCategoryLabels[cat]} | ${count} | ${percentage}% |\n`;
        }
        content += '\n';
        content += `## 💡 分析建议\n\n`;
        for (const recommendation of report.recommendations) {
            content += `- ${recommendation}\n`;
        }
        content += '\n';
        content += `## 🔝 退信原因排行\n\n`;
        content += `| 排名 | 原因 | 次数 | 分类 |\n`;
        content += `|------|------|------|------|\n`;
        for (let i = 0; i < Math.min(10, report.topReasons.length); i++) {
            const reason = report.topReasons[i];
            content += `| ${i + 1} | ${reason.reason} | ${reason.count} | ${types_1.BounceCategoryLabels[reason.category]} |\n`;
        }
        content += '\n';
        content += `## 📦 批次详情\n\n`;
        for (const [batchId, batch] of Object.entries(report.batches)) {
            content += `### 批次: ${batchId}\n\n`;
            content += `- 退信总数: ${batch.totalBounces}\n`;
            content += `- 唯一收件人: ${batch.uniqueRecipients}\n`;
            content += `- 可重试数量: ${batch.retryEligibleCount}\n\n`;
            content += `**分类统计:**\n`;
            content += `| 分类 | 数量 |\n`;
            content += `|------|------|\n`;
            for (const [cat, count] of Object.entries(batch.categoryBreakdown)) {
                content += `| ${types_1.BounceCategoryLabels[cat]} | ${count} |\n`;
            }
            content += '\n';
            if (Object.keys(batch.providerBreakdown).length > 0) {
                content += `**供应商分布:**\n`;
                content += `| 供应商 | 数量 |\n`;
                content += `|--------|------|\n`;
                for (const [provider, count] of Object.entries(batch.providerBreakdown)) {
                    content += `| ${provider} | ${count} |\n`;
                }
                content += '\n';
            }
            if (batch.repeatedBounces.length > 0) {
                content += `**多次退信邮箱:**\n`;
                content += `| 邮箱 | 退信次数 | 首次退信 | 最后退信 |\n`;
                content += `|------|----------|----------|----------|\n`;
                for (const bounce of batch.repeatedBounces.slice(0, 10)) {
                    content += `| ${bounce.recipient} | ${bounce.count} | ${new Date(bounce.firstBounce).toLocaleString('zh-CN')} | ${new Date(bounce.lastBounce).toLocaleString('zh-CN')} |\n`;
                }
                content += '\n';
            }
        }
        content += `## 📋 退信记录明细\n\n`;
        content += `| 收件人 | 分类 | 原因 | 可重试 | 重试建议 | 供应商 | 批次 |\n`;
        content += `|--------|------|------|--------|----------|--------|------|\n`;
        for (const record of records.slice(0, 100)) {
            const retryInfo = record.retrySuggestion.shouldRetry
                ? `${record.retrySuggestion.retryAfterHours || '?'}小时后`
                : '不建议';
            content += `| ${record.recipient} | ${types_1.BounceCategoryLabels[record.category]} | ${record.reason} | ${record.retrySuggestion.shouldRetry ? '是' : '否'} | ${retryInfo} | ${record.provider || '-'} | ${record.batchId || '-'} |\n`;
        }
        if (records.length > 100) {
            content += `\n> 仅显示前 100 条记录，完整数据请查看 JSON 报告\n`;
        }
        content += `\n---\n`;
        content += `*本报告由 bounce-analyzer CLI 工具自动生成*\n`;
        return content;
    }
    writeDetailedJson(records, filename = 'detailed-records.json') {
        const filePath = path.join(this.outputDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8');
        return filePath;
    }
    writeRetryList(records, filename = 'retry-list.txt') {
        const filePath = path.join(this.outputDir, filename);
        const retryRecords = records.filter(r => r.retrySuggestion.shouldRetry);
        let content = `# 可重试邮箱列表\n`;
        content += `# 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
        content += `# 总数量: ${retryRecords.length}\n\n`;
        content += `# 格式: 邮箱,建议等待小时数,最大重试次数,退信分类\n`;
        for (const record of retryRecords) {
            content += `${record.recipient},${record.retrySuggestion.retryAfterHours || 4},${record.retrySuggestion.maxRetries},${record.category}\n`;
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    writeSuppressionList(records, filename = 'suppression-list.txt') {
        const filePath = path.join(this.outputDir, filename);
        const suppressionRecords = records.filter(r => !r.retrySuggestion.shouldRetry);
        const uniqueEmails = [...new Set(suppressionRecords.map(r => r.recipient))];
        let content = `# 抑制列表（不建议继续发送）\n`;
        content += `# 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
        content += `# 总数量: ${uniqueEmails.length}\n\n`;
        for (const email of uniqueEmails) {
            content += `${email}\n`;
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
}
exports.OutputHandler = OutputHandler;
//# sourceMappingURL=output-handler.js.map