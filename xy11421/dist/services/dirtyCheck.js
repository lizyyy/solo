"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkMissingFields = checkMissingFields;
exports.checkCrossDate = checkCrossDate;
exports.checkNameChanged = checkNameChanged;
exports.checkAmountConflict = checkAmountConflict;
exports.checkQuantityConflict = checkQuantityConflict;
exports.checkDuplicate = checkDuplicate;
exports.saveDirtyRecord = saveDirtyRecord;
exports.getDirtyRecords = getDirtyRecords;
exports.fixDirtyRecord = fixDirtyRecord;
exports.getDirtyStats = getDirtyStats;
const database_1 = require("../database");
const uuid_1 = require("uuid");
const moment_1 = __importDefault(require("moment"));
function checkMissingFields(data, requiredFields) {
    const missing = requiredFields.filter(field => !data[field] && data[field] !== 0);
    if (missing.length > 0) {
        return {
            dirtyType: 'missing_field',
            fieldName: missing.join(', '),
            description: `缺少必填字段: ${missing.join(', ')}`,
            suggestion: '请补充缺失的字段信息'
        };
    }
    return null;
}
function checkCrossDate(dateStr, referenceDate, dateField) {
    if (!dateStr || !referenceDate)
        return null;
    const date = (0, moment_1.default)(dateStr, 'YYYY-MM-DD', true);
    const refDate = (0, moment_1.default)(referenceDate, 'YYYY-MM-DD', true);
    if (!date.isValid() || !refDate.isValid())
        return null;
    const diffDays = date.diff(refDate, 'days');
    if (Math.abs(diffDays) > 30) {
        return {
            dirtyType: 'cross_date',
            fieldName: dateField,
            originalValue: dateStr,
            expectedValue: `与参考日期相差不超过30天`,
            description: `${dateField}日期(${dateStr})与参考日期(${referenceDate})相差${diffDays}天，超过30天范围`,
            suggestion: '请检查日期是否正确，是否为跨期记录'
        };
    }
    return null;
}
function checkNameChanged(currentName, previousName, nameField, vin) {
    if (!currentName || !previousName)
        return null;
    if (currentName !== previousName) {
        return {
            dirtyType: 'name_changed',
            fieldName: nameField,
            originalValue: previousName,
            expectedValue: currentName,
            description: `车辆VIN[${vin}]的${nameField}发生变更: "${previousName}" -> "${currentName}"`,
            suggestion: '请确认是否为同一车辆的名称变更，或是否存在VIN重复使用'
        };
    }
    return null;
}
function checkAmountConflict(currentAmount, expectedAmount, amountField, tolerance = 0.05) {
    if (currentAmount === undefined || expectedAmount === undefined)
        return null;
    const diff = Math.abs(currentAmount - expectedAmount);
    const ratio = expectedAmount > 0 ? diff / expectedAmount : 0;
    if (ratio > tolerance) {
        return {
            dirtyType: 'amount_conflict',
            fieldName: amountField,
            originalValue: String(currentAmount),
            expectedValue: String(expectedAmount),
            description: `${amountField}金额冲突: 当前${currentAmount}，预期${expectedAmount}，差异${(ratio * 100).toFixed(2)}%`,
            suggestion: `请确认金额是否正确，容差范围${tolerance * 100}%`
        };
    }
    return null;
}
function checkQuantityConflict(currentQty, expectedQty, qtyField) {
    if (currentQty === undefined || expectedQty === undefined)
        return null;
    if (currentQty !== expectedQty) {
        return {
            dirtyType: 'quantity_conflict',
            fieldName: qtyField,
            originalValue: String(currentQty),
            expectedValue: String(expectedQty),
            description: `${qtyField}数量冲突: 当前${currentQty}，预期${expectedQty}`,
            suggestion: '请确认数量是否正确'
        };
    }
    return null;
}
async function checkDuplicate(sourceType, uniqueKey, keyValue) {
    const db = await (0, database_1.getDatabase)();
    const tableMap = {
        inspection: 'inspections',
        repair_quote: 'repair_quotes',
        photo_list: 'photo_lists',
        shift_record: 'shift_records',
        manual_price: 'manual_prices'
    };
    const table = tableMap[sourceType];
    const result = await db.get(`SELECT COUNT(*) as count FROM ${table} WHERE ${uniqueKey} = ?`, [keyValue]);
    if (result.count > 0) {
        return {
            dirtyType: 'duplicate',
            fieldName: uniqueKey,
            originalValue: keyValue,
            description: `${sourceType}中存在重复的${uniqueKey}: ${keyValue}`,
            suggestion: '请检查是否为重复导入，或更新已有记录'
        };
    }
    return null;
}
async function saveDirtyRecord(sourceType, sourceId, checkResult, batchId) {
    const db = await (0, database_1.getDatabase)();
    const id = (0, uuid_1.v4)();
    await db.run(`
    INSERT INTO dirty_records
    (id, sourceType, sourceId, dirtyType, fieldName, originalValue, expectedValue, description, suggestion, batchId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        id,
        sourceType,
        sourceId,
        checkResult.dirtyType,
        checkResult.fieldName,
        checkResult.originalValue,
        checkResult.expectedValue,
        checkResult.description,
        checkResult.suggestion,
        batchId
    ]);
    return id;
}
async function getDirtyRecords(sourceType, isFixed) {
    const db = await (0, database_1.getDatabase)();
    let sql = 'SELECT * FROM dirty_records';
    const params = [];
    const conditions = [];
    if (sourceType) {
        conditions.push('sourceType = ?');
        params.push(sourceType);
    }
    if (isFixed !== undefined) {
        conditions.push('isFixed = ?');
        params.push(isFixed ? 1 : 0);
    }
    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY createdAt DESC';
    return db.all(sql, params);
}
async function fixDirtyRecord(dirtyId, fixedValue, fixedBy) {
    const db = await (0, database_1.getDatabase)();
    const dirty = await db.get('SELECT * FROM dirty_records WHERE id = ?', [dirtyId]);
    if (!dirty)
        return false;
    await db.run(`
    UPDATE dirty_records
    SET isFixed = 1, fixedBy = ?, fixedAt = CURRENT_TIMESTAMP, fixedValue = ?
    WHERE id = ?
  `, [fixedBy, fixedValue, dirtyId]);
    const tableMap = {
        inspection: 'inspections',
        repair_quote: 'repair_quotes',
        photo_list: 'photo_lists',
        shift_record: 'shift_records',
        manual_price: 'manual_prices'
    };
    if (dirty.fieldName) {
        await db.run(`
      UPDATE ${tableMap[dirty.sourceType]}
      SET ${dirty.fieldName} = ?, status = 'fixed', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [fixedValue, dirty.sourceId]);
    }
    return true;
}
async function getDirtyStats() {
    const db = await (0, database_1.getDatabase)();
    const totalResult = await db.get('SELECT COUNT(*) as count FROM dirty_records');
    const fixedResult = await db.get('SELECT COUNT(*) as count FROM dirty_records WHERE isFixed = 1');
    const byTypeResult = await db.all(`
    SELECT dirtyType, COUNT(*) as count 
    FROM dirty_records 
    GROUP BY dirtyType
  `);
    const bySourceResult = await db.all(`
    SELECT sourceType, COUNT(*) as count 
    FROM dirty_records 
    GROUP BY sourceType
  `);
    const byType = {
        missing_field: 0,
        cross_date: 0,
        name_changed: 0,
        amount_conflict: 0,
        quantity_conflict: 0,
        duplicate: 0
    };
    byTypeResult.forEach(r => byType[r.dirtyType] = r.count);
    const bySource = {
        inspection: 0,
        repair_quote: 0,
        photo_list: 0,
        shift_record: 0,
        manual_price: 0
    };
    bySourceResult.forEach(r => bySource[r.sourceType] = r.count);
    return {
        total: totalResult.count,
        byType,
        bySource,
        fixed: fixedResult.count,
        pending: totalResult.count - fixedResult.count
    };
}
