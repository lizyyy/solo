"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePending = handlePending;
const reconciler_1 = require("../services/reconciler");
const logger_1 = require("../utils/logger");
function handlePending(date, store) {
    try {
        logger_1.logger.heading(`待处理项 - ${date}`);
        const reconciler = new reconciler_1.Reconciler(store);
        const pendingItems = reconciler.getPendingItems(date);
        if (pendingItems.length === 0) {
            logger_1.logger.success(`没有待处理项`);
            return;
        }
        logger_1.logger.warning(`发现 ${pendingItems.length} 个待处理项:`);
        logger_1.logger.line();
        const rows = pendingItems.map(item => [
            item.appointment.appointmentId,
            item.appointment.patientName,
            item.appointment.contrastAgent,
            `${item.plannedDose}ml`,
            item.status === 'missing_usage' ? '缺少用药' : '待确认',
            item.issues[0]?.message || ''
        ]);
        logger_1.logger.table(['预约号', '患者', '药剂', '计划剂量', '状态', '说明'], rows);
        logger_1.logger.line();
        logger_1.logger.info(`建议:`);
        logger_1.logger.bullet('1. 检查开瓶记录是否完整');
        logger_1.logger.bullet('2. 确认患者是否已完成检查');
        logger_1.logger.bullet('3. 如需标记人工修正，请使用 correct 命令');
    }
    catch (e) {
        logger_1.logger.error(`查询失败: ${e.message}`);
        process.exit(1);
    }
}
