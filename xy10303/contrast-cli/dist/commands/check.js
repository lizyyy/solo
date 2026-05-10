"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCheck = handleCheck;
const reconciler_1 = require("../services/reconciler");
const logger_1 = require("../utils/logger");
function handleCheck(date, store) {
    try {
        logger_1.logger.heading(`核销检查 - ${date}`);
        const reconciler = new reconciler_1.Reconciler(store);
        const result = reconciler.reconcile(date);
        logger_1.logger.info(`预约总数: ${result.totalAppointments}`);
        logger_1.logger.info(`已核销: ${result.reconciled}`);
        logger_1.logger.info(`待处理: ${result.pending}`);
        if (result.issues.length > 0) {
            logger_1.logger.line();
            logger_1.logger.warning(`发现 ${result.issues.length} 个问题:`);
            logger_1.logger.line();
            const errors = result.issues.filter(i => i.severity === 'error');
            const warnings = result.issues.filter(i => i.severity === 'warning');
            const infos = result.issues.filter(i => i.severity === 'info');
            if (errors.length > 0) {
                logger_1.logger.error(`错误 (${errors.length}):`);
                errors.forEach(issue => {
                    logger_1.logger.bullet(formatIssue(issue));
                });
                logger_1.logger.line();
            }
            if (warnings.length > 0) {
                logger_1.logger.warning(`警告 (${warnings.length}):`);
                warnings.forEach(issue => {
                    logger_1.logger.bullet(formatIssue(issue));
                });
                logger_1.logger.line();
            }
            if (infos.length > 0) {
                logger_1.logger.info(`提示 (${infos.length}):`);
                infos.forEach(issue => {
                    logger_1.logger.bullet(formatIssue(issue));
                });
                logger_1.logger.line();
            }
        }
        if (result.batchSummary.length > 0) {
            logger_1.logger.heading(`批次汇总`);
            const rows = result.batchSummary.map(b => [
                b.batchNumber,
                b.contrastAgent,
                `${b.totalVolume}ml`,
                `${b.usedVolume}ml`,
                `${b.refundedVolume}ml`,
                `${b.remainingVolume}ml`,
                b.issue || ''
            ]);
            logger_1.logger.table(['批号', '药剂', '总量', '已用', '退费', '剩余', '问题'], rows);
        }
        if (result.manualCorrections.length > 0) {
            logger_1.logger.line();
            logger_1.logger.info(`人工修正记录 (${result.manualCorrections.length} 条):`);
            result.manualCorrections.forEach(c => {
                logger_1.logger.bullet(`[${c.type}] ${c.reason} (操作人: ${c.operator})`);
            });
        }
        if (result.issues.some(i => i.severity === 'error')) {
            process.exit(1);
        }
    }
    catch (e) {
        logger_1.logger.error(`检查失败: ${e.message}`);
        process.exit(1);
    }
}
function formatIssue(issue) {
    let msg = issue.message;
    if (issue.appointmentId) {
        msg = `[${issue.appointmentId}] ${msg}`;
    }
    if (issue.batchNumber) {
        msg = `[${issue.batchNumber}] ${msg}`;
    }
    return msg;
}
