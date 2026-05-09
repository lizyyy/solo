"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateComprehensiveReport = exports.generateCacheReport = exports.generateReplayReport = exports.generateFieldMissingReport = void 0;
const moment_1 = __importDefault(require("moment"));
const generateFieldMissingReport = (checkResult) => {
    const { summary, productDiffs } = checkResult;
    const issues = productDiffs.filter((p) => p.hasIssue);
    let report = `# 字段缺失检测报告\n\n`;
    report += `**生成时间**: ${(0, moment_1.default)().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    report += `**检查结果 ID**: ${checkResult.id}\n\n`;
    report += `## 概要\n\n`;
    report += `| 指标 | 数值 |\n`;
    report += `|------|------|\n`;
    report += `| 总检查商品数 | ${summary.totalChecked} |\n`;
    report += `| 有问题商品数 | ${summary.withIssues} |\n`;
    report += `| 无问题商品数 | ${summary.withoutIssues} |\n`;
    report += `| 缺失字段总数 | ${summary.missingFieldsTotal} |\n`;
    report += `| 不一致字段总数 | ${summary.mismatchedFieldsTotal} |\n\n`;
    if (summary.mostCommonMissingFields.length > 0) {
        report += `### 最常缺失的字段\n\n`;
        report += `| 字段名 | 缺失次数 |\n`;
        report += `|--------|----------|\n`;
        summary.mostCommonMissingFields.forEach(({ field, count }) => {
            report += `| ${field} | ${count} |\n`;
        });
        report += `\n`;
    }
    report += `## 问题详情\n\n`;
    if (issues.length === 0) {
        report += `所有商品字段完整，未发现问题。\n`;
        return report;
    }
    issues.slice(0, 50).forEach((diff, index) => {
        report += `### ${index + 1}. ${diff.productName} (ID: ${diff.productId})\n\n`;
        if (diff.missingFields.length > 0) {
            report += `**缺失字段**: ${diff.missingFields.join(', ')}\n\n`;
        }
        if (diff.mismatchedFields.length > 0) {
            report += `**不一致字段**:\n\n`;
            diff.mismatchedFields.forEach((m) => {
                report += `- **${m.fieldName}**: 索引值=\`${JSON.stringify(m.indexValue)}\`, 源数据=\`${JSON.stringify(m.sourceValue)}\`\n`;
            });
            report += `\n`;
        }
    });
    if (issues.length > 50) {
        report += `\n... 还有 ${issues.length - 50} 个问题商品未显示，请查看完整检查结果文件。\n`;
    }
    return report;
};
exports.generateFieldMissingReport = generateFieldMissingReport;
const generateReplayReport = (task) => {
    let report = `# 重建回放任务报告\n\n`;
    report += `**生成时间**: ${(0, moment_1.default)().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    report += `**任务 ID**: ${task.id}\n\n`;
    report += `**任务名称**: ${task.name}\n\n`;
    report += `## 执行概要\n\n`;
    report += `| 指标 | 数值 |\n`;
    report += `|------|------|\n`;
    report += `| 状态 | ${task.status} |\n`;
    report += `| 开始时间 | ${task.startTime || '-'} |\n`;
    report += `| 结束时间 | ${task.endTime || '-'} |\n`;
    report += `| 总商品数 | ${task.productIds.length} |\n`;
    report += `| 成功数 | ${task.successCount} |\n`;
    report += `| 失败数 | ${task.failedCount} |\n\n`;
    if (task.errors.length > 0) {
        report += `## 错误信息\n\n`;
        task.errors.forEach((err, i) => {
            report += `${i + 1}. ${err}\n`;
        });
    }
    return report;
};
exports.generateReplayReport = generateReplayReport;
const generateCacheReport = (record) => {
    let report = `# 缓存刷新记录报告\n\n`;
    report += `**生成时间**: ${(0, moment_1.default)().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    report += `**记录 ID**: ${record.id}\n\n`;
    report += `## 执行概要\n\n`;
    report += `| 指标 | 数值 |\n`;
    report += `|------|------|\n`;
    report += `| 状态 | ${record.status} |\n`;
    report += `| 时间 | ${record.timestamp} |\n`;
    report += `| 总商品数 | ${record.productIds.length} |\n`;
    report += `| 刷新成功 | ${record.refreshedCount} |\n`;
    report += `| 刷新失败 | ${record.failedCount} |\n\n`;
    if (record.errors.length > 0) {
        report += `## 错误信息\n\n`;
        record.errors.forEach((err, i) => {
            report += `${i + 1}. ${err}\n`;
        });
    }
    return report;
};
exports.generateCacheReport = generateCacheReport;
const generateComprehensiveReport = (checkResult, replayTask, cacheRecord) => {
    let report = `# 综合报告\n\n`;
    report += `**生成时间**: ${(0, moment_1.default)().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    report += `---\n\n`;
    report += (0, exports.generateFieldMissingReport)(checkResult);
    if (replayTask) {
        report += `\n---\n\n`;
        report += (0, exports.generateReplayReport)(replayTask);
    }
    if (cacheRecord) {
        report += `\n---\n\n`;
        report += (0, exports.generateCacheReport)(cacheRecord);
    }
    return report;
};
exports.generateComprehensiveReport = generateComprehensiveReport;
//# sourceMappingURL=report.js.map