"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixCommand = fixCommand;
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const moment_1 = __importDefault(require("moment"));
const database_1 = require("../database");
async function fixCommand(workDir, options) {
    const absoluteDir = path_1.default.resolve(workDir);
    const db = (0, database_1.getDatabase)(absoluteDir);
    const operator = options.operator || 'cli';
    if (options.withdraw) {
        await withdrawRecord(db, options.withdraw, operator, options.reason || '人工撤回');
        return;
    }
    if (options.freeze) {
        await freezeFact(db, options.freeze, operator, options.reason || '导出前冻结');
        return;
    }
    if (options.unfreeze) {
        await unfreezeFact(db, options.unfreeze, operator);
        return;
    }
    if (options.error && options.reason) {
        await resolveError(db, options.error, operator, options.reason);
        return;
    }
    if (options.record && options.field && options.value !== undefined) {
        await overrideField(db, options.record, options.field, options.value, operator, options.reason || '人工改判');
        return;
    }
    console.log(chalk_1.default.yellow('请指定修复操作:'));
    console.log('');
    console.log(chalk_1.default.blue('撤回记录:'));
    console.log(chalk_1.default.gray('  pmi fix --withdraw <记录ID> --reason "撤回原因"'));
    console.log('');
    console.log(chalk_1.default.blue('解决错误:'));
    console.log(chalk_1.default.gray('  pmi fix --error <错误ID> --reason "解决方式说明"'));
    console.log('');
    console.log(chalk_1.default.blue('人工改判字段:'));
    console.log(chalk_1.default.gray('  pmi fix --record <记录ID> --field <字段名> --value <新值> --reason "改判原因"'));
    console.log('');
    console.log(chalk_1.default.blue('冻结/解冻工单:'));
    console.log(chalk_1.default.gray('  pmi fix --freeze <工单号> --reason "导出前冻结"'));
    console.log(chalk_1.default.gray('  pmi fix --unfreeze <工单号>'));
}
async function withdrawRecord(db, recordId, operator, reason) {
    await db.updateRawRecordStatus(recordId, 'withdrawn');
    await db.logChange(recordId, 'status', 'failed', 'withdrawn', operator, reason);
    console.log(chalk_1.default.green('OK 记录 ' + recordId + ' 已撤回'));
}
async function freezeFact(db, orderNumber, operator, reason) {
    const fact = await db.findFactByOrderNumber(orderNumber);
    if (!fact) {
        console.log(chalk_1.default.red('ERROR 工单 ' + orderNumber + ' 不存在'));
        return;
    }
    if (fact.isFrozen) {
        console.log(chalk_1.default.yellow('工单 ' + orderNumber + ' 已冻结'));
        return;
    }
    await db.updateFactRecord(fact.id, { isFrozen: true, frozenBy: operator });
    await db.logChange(fact.id, 'frozen', 'false', 'true', operator, reason);
    console.log(chalk_1.default.green('OK 工单 ' + orderNumber + ' 已冻结'));
}
async function unfreezeFact(db, orderNumber, operator) {
    const fact = await db.findFactByOrderNumber(orderNumber);
    if (!fact) {
        console.log(chalk_1.default.red('ERROR 工单 ' + orderNumber + ' 不存在'));
        return;
    }
    if (!fact.isFrozen) {
        console.log(chalk_1.default.yellow('工单 ' + orderNumber + ' 未冻结'));
        return;
    }
    await db.updateFactRecord(fact.id, { isFrozen: false, frozenBy: operator });
    await db.logChange(fact.id, 'frozen', 'true', 'false', operator, '人工解冻');
    console.log(chalk_1.default.green('OK 工单 ' + orderNumber + ' 已解冻'));
}
async function resolveError(db, errorId, operator, resolution) {
    await db.resolveValidationError(errorId, operator, resolution);
    console.log(chalk_1.default.green('OK 错误 ' + errorId + ' 已标记为已解决'));
    console.log(chalk_1.default.gray('  解决方式: ' + resolution));
}
async function overrideField(db, recordId, field, value, operator, reason) {
    const history = await db.getImportHistory(100);
    let rawRecord = null;
    for (const session of history) {
        const records = await db.getRawRecordsByBatch(session.batchId);
        rawRecord = records.find((r) => r.id === recordId);
        if (rawRecord)
            break;
    }
    if (!rawRecord) {
        console.log(chalk_1.default.red('ERROR 记录 ' + recordId + ' 不存在'));
        return;
    }
    const standardizedRecords = await db.getStandardizedRecordsByFact('');
    const stdRecord = standardizedRecords.find((s) => s.rawRecordId === recordId);
    if (stdRecord) {
        const oldValue = stdRecord[field] || '';
        await db.logChange(stdRecord.factId, field, oldValue, value, operator, reason);
        const now = (0, moment_1.default)().toISOString();
        const fieldMap = {
            orderNumber: 'order_number',
            residentName: 'resident_name',
            roomNumber: 'room_number',
            phoneNumber: 'phone_number',
            repairType: 'repair_type',
            description: 'description',
            reportTime: 'report_time',
            technicianName: 'technician_name',
            arrivalTime: 'arrival_time',
            completionTime: 'completion_time',
            repairResult: 'repair_result',
            materialName: 'material_name',
            materialQuantity: 'material_quantity',
            materialUnit: 'material_unit',
            supervisorNote: 'supervisor_note',
        };
        const dbField = fieldMap[field] || field;
        const sql = 'UPDATE standardized_records SET ' + dbField + ' = ?, is_manual_override = 1, standardized_at = ?, standardized_by = ? WHERE raw_record_id = ?';
        await db.run(sql, [value, now, operator, recordId]);
        const fact = await db.findFactByOrderNumber(stdRecord.orderNumber);
        if (fact) {
            await db.updateFactRecord(fact.id, { currentStatus: '已修正' });
        }
        await db.updateRawRecordStatus(recordId, 'fixed');
        console.log(chalk_1.default.green('OK 字段 ' + field + ' 已更新'));
        console.log(chalk_1.default.gray('  原值: ' + oldValue));
        console.log(chalk_1.default.gray('  新值: ' + value));
    }
    else {
        console.log(chalk_1.default.red('ERROR 未找到标准化记录'));
    }
}
//# sourceMappingURL=fix.js.map