"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleReport = handleReport;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const reconciler_1 = require("../services/reconciler");
const logger_1 = require("../utils/logger");
function handleReport(date, options, store) {
    try {
        logger_1.logger.heading(`日结报告 - ${date}`);
        const reconciler = new reconciler_1.Reconciler(store);
        const report = reconciler.generateDailyReport(date);
        const format = options.format || 'text';
        if (format === 'json') {
            if (options.output) {
                const outputPath = path_1.default.resolve(options.output);
                fs_1.default.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
                logger_1.logger.success(`报告已保存到: ${outputPath}`);
            }
            else {
                logger_1.logger.json(report);
            }
        }
        else {
            const textReport = generateTextReport(report);
            if (options.output) {
                const outputPath = path_1.default.resolve(options.output);
                fs_1.default.writeFileSync(outputPath, textReport, 'utf-8');
                logger_1.logger.success(`报告已保存到: ${outputPath}`);
            }
            else {
                console.log(textReport);
            }
        }
        if (report.reconciliationStatus === 'has_errors') {
            process.exit(1);
        }
    }
    catch (e) {
        logger_1.logger.error(`生成报告失败: ${e.message}`);
        process.exit(1);
    }
}
function generateTextReport(report) {
    const lines = [];
    lines.push('='.repeat(60));
    lines.push(`影像科增强药剂日结报告`);
    lines.push(`日期: ${report.date}`);
    lines.push(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
    lines.push(`核销状态: ${formatStatus(report.reconciliationStatus)}`);
    lines.push('='.repeat(60));
    lines.push('');
    lines.push('一、预约统计');
    lines.push('-'.repeat(30));
    lines.push(`  总预约数: ${report.appointmentStats.total}`);
    lines.push(`  已完成: ${report.appointmentStats.completed}`);
    lines.push(`  待处理: ${report.appointmentStats.pending}`);
    lines.push(`  已退费: ${report.appointmentStats.refunded}`);
    lines.push(`  完成率: ${report.appointmentStats.total > 0
        ? ((report.appointmentStats.completed + report.appointmentStats.refunded) / report.appointmentStats.total * 100).toFixed(1)
        : '0.0'}%`);
    lines.push('');
    if (report.batchStats.length > 0) {
        lines.push('二、批次汇总');
        lines.push('-'.repeat(30));
        lines.push('');
        lines.push(`${'批号'.padEnd(15)} ${'药剂'.padEnd(15)} ${'总量'.padEnd(8)} ${'已用'.padEnd(8)} ${'退费'.padEnd(8)} ${'剩余'.padEnd(8)} ${'状态'}`);
        lines.push('-'.repeat(75));
        report.batchStats.forEach(b => {
            const status = b.issue ? `⚠ ${b.issue}` : '✓ 正常';
            lines.push(`${b.batchNumber.padEnd(15)} ${b.contrastAgent.padEnd(15)} ${(b.totalVolume + 'ml').padEnd(8)} ${(b.usedVolume + 'ml').padEnd(8)} ${(b.refundedVolume + 'ml').padEnd(8)} ${(b.remainingVolume + 'ml').padEnd(8)} ${status}`);
        });
        lines.push('');
    }
    if (report.issues.length > 0) {
        lines.push('三、问题列表');
        lines.push('-'.repeat(30));
        lines.push('');
        const errors = report.issues.filter(i => i.severity === 'error');
        const warnings = report.issues.filter(i => i.severity === 'warning');
        if (errors.length > 0) {
            lines.push(`【错误】 (${errors.length} 条)`);
            errors.forEach((e, i) => {
                lines.push(`  ${i + 1}. [${e.type}] ${e.message}`);
            });
            lines.push('');
        }
        if (warnings.length > 0) {
            lines.push(`【警告】 (${warnings.length} 条)`);
            warnings.forEach((w, i) => {
                lines.push(`  ${i + 1}. [${w.type}] ${w.message}`);
            });
            lines.push('');
        }
    }
    if (report.manualCorrections.length > 0) {
        lines.push('四、人工修正记录');
        lines.push('-'.repeat(30));
        lines.push('');
        report.manualCorrections.forEach((c, i) => {
            lines.push(`  ${i + 1}. [${formatCorrectionType(c.type)}] ${c.reason}`);
            lines.push(`     操作人: ${c.operator} | 时间: ${new Date(c.createdAt).toLocaleString('zh-CN')}`);
            if (c.appointmentId)
                lines.push(`     预约号: ${c.appointmentId}`);
            if (c.batchNumber)
                lines.push(`     批号: ${c.batchNumber}`);
            if (c.originalValue || c.correctedValue) {
                lines.push(`     ${c.originalValue || '-'} → ${c.correctedValue || '-'}`);
            }
        });
        lines.push('');
    }
    lines.push('='.repeat(60));
    lines.push(`报告结束`);
    lines.push('='.repeat(60));
    return lines.join('\n');
}
function formatStatus(status) {
    const statusMap = {
        complete: '✓ 完整',
        pending: '⚠ 待处理',
        has_errors: '✗ 存在错误'
    };
    return statusMap[status] || status;
}
function formatCorrectionType(type) {
    const typeMap = {
        dose_adjustment: '剂量调整',
        refund_confirm: '退费确认',
        batch_merge: '批次合并',
        other: '其他'
    };
    return typeMap[type] || type;
}
