"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCorrect = handleCorrect;
const logger_1 = require("../utils/logger");
function handleCorrect(date, options, store) {
    try {
        logger_1.logger.heading(`人工修正`);
        const type = options.type;
        const validTypes = ['dose_adjustment', 'refund_confirm', 'batch_merge', 'other'];
        if (!validTypes.includes(type)) {
            logger_1.logger.error(`无效的修正类型: ${type}`);
            logger_1.logger.info(`有效类型: ${validTypes.join(', ')}`);
            process.exit(1);
        }
        if (options.appointmentId && !store.getAppointment(options.appointmentId)) {
            logger_1.logger.error(`预约号不存在: ${options.appointmentId}`);
            process.exit(1);
        }
        if (options.batchNumber && !store.getBatch(options.batchNumber)) {
            logger_1.logger.error(`药剂批号不存在: ${options.batchNumber}`);
            process.exit(1);
        }
        const correction = store.addManualCorrection({
            date,
            type,
            appointmentId: options.appointmentId,
            batchNumber: options.batchNumber,
            reason: options.reason,
            originalValue: options.original,
            correctedValue: options.corrected,
            operator: options.operator
        });
        logger_1.logger.success(`修正记录已添加`);
        logger_1.logger.line();
        logger_1.logger.info(`修正详情:`);
        logger_1.logger.bullet(`ID: ${correction.id}`);
        logger_1.logger.bullet(`日期: ${correction.date}`);
        logger_1.logger.bullet(`类型: ${formatType(correction.type)}`);
        if (correction.appointmentId) {
            logger_1.logger.bullet(`预约号: ${correction.appointmentId}`);
        }
        if (correction.batchNumber) {
            logger_1.logger.bullet(`批号: ${correction.batchNumber}`);
        }
        logger_1.logger.bullet(`原因: ${correction.reason}`);
        if (correction.originalValue) {
            logger_1.logger.bullet(`原值: ${correction.originalValue}`);
        }
        if (correction.correctedValue) {
            logger_1.logger.bullet(`修正值: ${correction.correctedValue}`);
        }
        logger_1.logger.bullet(`操作人: ${correction.operator}`);
    }
    catch (e) {
        logger_1.logger.error(`修正失败: ${e.message}`);
        process.exit(1);
    }
}
function formatType(type) {
    const typeMap = {
        dose_adjustment: '剂量调整',
        refund_confirm: '退费确认',
        batch_merge: '批次合并',
        other: '其他'
    };
    return typeMap[type] || type;
}
