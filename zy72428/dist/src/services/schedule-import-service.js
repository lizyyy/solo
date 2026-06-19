"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleImportService = exports.ScheduleImportService = void 0;
const data_store_1 = require("../store/data-store");
const messages_1 = require("../utils/messages");
class ScheduleImportService {
    importSchedule(inputs) {
        const batchId = data_store_1.dataStore.generateBatchId();
        const imported = [];
        const reused = [];
        const duplicates = [];
        const errors = [];
        const warnings = [];
        for (const input of inputs) {
            const existingDuplicates = data_store_1.dataStore.findDuplicateScheduleRecords(input);
            if (existingDuplicates.length > 0) {
                duplicates.push(...existingDuplicates);
                warnings.push((0, messages_1.createWarningMessage)(`${input.performerName} 在 ${input.sessionDate.toLocaleDateString()} ${input.locationName} 的"${input.trackName}"排班已存在`, '如确需重复导入，请手动确认后再操作'));
                continue;
            }
            const record = {
                id: data_store_1.dataStore.generateId(),
                sessionDate: input.sessionDate,
                performerId: input.performerId,
                performerName: input.performerName,
                locationId: input.locationId,
                locationName: input.locationName,
                trackName: input.trackName.trim(),
                isConsumed: input.isConsumed,
                isLeave: input.isLeave,
                consumedHours: input.consumedHours,
                source: input.source,
                importBatchId: batchId,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            data_store_1.dataStore.saveScheduleRecord(record);
            imported.push(record);
        }
        if (imported.length > 0) {
            warnings.push((0, messages_1.createInfoMessage)(`成功导入 ${imported.length} 条排班记录`));
        }
        if (duplicates.length > 0) {
            warnings.push((0, messages_1.createWarningMessage)(`检测到 ${duplicates.length} 条重复排班记录已跳过`, '请核对导入材料，确认是否有误'));
        }
        return {
            success: errors.length === 0,
            imported,
            reused,
            duplicates,
            errors,
            warnings,
            batchId,
        };
    }
    recalculateConsumedHours(batchId) {
        const records = data_store_1.dataStore.getScheduleRecordsByBatch(batchId);
        const updated = [];
        const messages = [];
        for (const record of records) {
            const shouldBeConsumed = !record.isLeave && record.consumedHours > 0;
            if (record.isConsumed !== shouldBeConsumed) {
                const updatedRecord = {
                    ...record,
                    isConsumed: shouldBeConsumed,
                    consumedHours: record.isLeave ? 0 : record.consumedHours,
                    updatedAt: new Date(),
                };
                data_store_1.dataStore.saveScheduleRecord(updatedRecord);
                updated.push(updatedRecord);
                if (record.isLeave && record.isConsumed) {
                    messages.push(`${record.performerName} 在 ${record.sessionDate.toLocaleDateString()} 的请假课时已更正为未消耗`);
                }
            }
        }
        return { updated, messages };
    }
}
exports.ScheduleImportService = ScheduleImportService;
exports.scheduleImportService = new ScheduleImportService();
