"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listReturnRecords = exports.confirmReturnReceipt = exports.getReturnRecordsBySample = exports.getReturnRecordById = exports.createReturnRecord = exports.listFinalizations = exports.getFinalizationBySample = exports.getFinalizationById = exports.finalizeSample = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
const historyService_1 = require("./historyService");
const sampleService_1 = require("./sampleService");
const finalizeSample = (data, operator) => {
    const sample = (0, sampleService_1.getSampleById)(data.sampleId);
    if (sample.status !== 'REVIEWED') {
        throw new response_1.AppError('只有评审完成的样品才能定版', response_1.errorCodes.BAD_REQUEST, 400);
    }
    if (data.finalQuantity < 0) {
        throw new response_1.AppError('最终数量不能为负数', response_1.errorCodes.VALIDATION_ERROR, 400);
    }
    if (data.finalUnitPrice < 0) {
        throw new response_1.AppError('最终单价不能为负数', response_1.errorCodes.VALIDATION_ERROR, 400);
    }
    const finalTotalAmount = data.finalQuantity * data.finalUnitPrice;
    const now = new Date().toISOString();
    const record = {
        id: (0, uuid_1.v4)(),
        sampleId: data.sampleId,
        sampleNo: sample.sampleNo,
        finalVersion: sample.version,
        approvedBy: operator,
        approvedAt: now,
        finalQuantity: data.finalQuantity,
        finalUnitPrice: data.finalUnitPrice,
        finalTotalAmount,
        remarks: data.remarks,
        attachments: data.attachments
    };
    const stmt = database_1.default.prepare(`
    INSERT INTO finalization_records (id, sample_id, sample_no, final_version, approved_by, approved_at, final_quantity, final_unit_price, final_total_amount, remarks, attachments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(record.id, record.sampleId, record.sampleNo, record.finalVersion, record.approvedBy, record.approvedAt, record.finalQuantity, record.finalUnitPrice, record.finalTotalAmount, record.remarks || null, record.attachments ? JSON.stringify(record.attachments) : null);
    (0, sampleService_1.updateSampleStatus)(data.sampleId, 'FINALIZED', operator);
    (0, sampleService_1.updateSampleInfo)(data.sampleId, {
        quantity: data.finalQuantity,
        unitPrice: data.finalUnitPrice
    }, operator);
    (0, sampleService_1.freezeSample)(data.sampleId, operator);
    (0, historyService_1.createHistoryRecord)('FINALIZATION', record.id, 'CREATE', `样品定版冻结 - 版本 ${record.finalVersion}`, operator, undefined, record);
    return record;
};
exports.finalizeSample = finalizeSample;
const getFinalizationById = (id) => {
    const row = database_1.default.prepare(`SELECT * FROM finalization_records WHERE id = ?`).get(id);
    if (!row) {
        throw new response_1.AppError(`定版记录 ${id} 不存在`, response_1.errorCodes.NOT_FOUND, 404);
    }
    return mapToFinalizationRecord(row);
};
exports.getFinalizationById = getFinalizationById;
const getFinalizationBySample = (sampleId) => {
    const row = database_1.default.prepare(`SELECT * FROM finalization_records WHERE sample_id = ? ORDER BY approved_at DESC LIMIT 1`).get(sampleId);
    return row ? mapToFinalizationRecord(row) : null;
};
exports.getFinalizationBySample = getFinalizationBySample;
const listFinalizations = (params = {}, page = 1, pageSize = 20) => {
    let query = `SELECT * FROM finalization_records WHERE 1=1`;
    const countQuery = `SELECT COUNT(*) as total FROM finalization_records WHERE 1=1`;
    const whereConditions = [];
    const queryParams = [];
    if (params.sampleId) {
        whereConditions.push(`sample_id = ?`);
        queryParams.push(params.sampleId);
    }
    if (params.approvedBy) {
        whereConditions.push(`approved_by LIKE ?`);
        queryParams.push(`%${params.approvedBy}%`);
    }
    if (params.startTime) {
        whereConditions.push(`approved_at >= ?`);
        queryParams.push(params.startTime);
    }
    if (params.endTime) {
        whereConditions.push(`approved_at <= ?`);
        queryParams.push(params.endTime);
    }
    if (whereConditions.length > 0) {
        query += ` AND ${whereConditions.join(' AND ')}`;
    }
    const countStmt = database_1.default.prepare(whereConditions.length > 0
        ? `${countQuery} AND ${whereConditions.join(' AND ')}`
        : countQuery);
    const countResult = countStmt.get(...queryParams);
    const total = countResult.total;
    query += ` ORDER BY approved_at DESC LIMIT ? OFFSET ?`;
    const paginationParams = [...queryParams, pageSize, (page - 1) * pageSize];
    const rows = database_1.default.prepare(query).all(...paginationParams);
    return {
        items: rows.map(mapToFinalizationRecord),
        total
    };
};
exports.listFinalizations = listFinalizations;
const createReturnRecord = (data, operator) => {
    const sample = (0, sampleService_1.getSampleById)(data.sampleId);
    if (sample.isFrozen) {
        throw new response_1.AppError('样品已冻结，无法退样', response_1.errorCodes.SAMPLE_FROZEN, 400);
    }
    if (sample.status === 'FINALIZED') {
        throw new response_1.AppError('已结版的样品无法退样', response_1.errorCodes.BAD_REQUEST, 400);
    }
    if (data.returnQuantity <= 0) {
        throw new response_1.AppError('退样数量必须大于 0', response_1.errorCodes.VALIDATION_ERROR, 400);
    }
    if (data.returnQuantity > sample.quantity) {
        throw new response_1.AppError(`退样数量不能超过样品数量 ${sample.quantity}`, response_1.errorCodes.VALIDATION_ERROR, 400);
    }
    const now = new Date().toISOString();
    const record = {
        id: (0, uuid_1.v4)(),
        sampleId: data.sampleId,
        sampleNo: sample.sampleNo,
        returnType: data.returnType,
        returnReason: data.returnReason,
        returnQuantity: data.returnQuantity,
        returnedBy: operator,
        returnedAt: now,
        trackingNo: data.trackingNo,
        remarks: data.remarks
    };
    const stmt = database_1.default.prepare(`
    INSERT INTO return_records (id, sample_id, sample_no, return_type, return_reason, return_quantity, returned_by, returned_at, tracking_no, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(record.id, record.sampleId, record.sampleNo, record.returnType, record.returnReason, record.returnQuantity, record.returnedBy, record.returnedAt, record.trackingNo || null, record.remarks || null);
    const remainingQuantity = sample.quantity - data.returnQuantity;
    if (remainingQuantity === 0) {
        (0, sampleService_1.updateSampleStatus)(data.sampleId, 'RETURNED', operator);
    }
    else {
        (0, sampleService_1.updateSampleInfo)(data.sampleId, { quantity: remainingQuantity }, operator);
    }
    (0, historyService_1.createHistoryRecord)('RETURN', record.id, 'CREATE', `退样记录 - ${record.returnType}，数量: ${record.returnQuantity}`, operator, undefined, record);
    return record;
};
exports.createReturnRecord = createReturnRecord;
const getReturnRecordById = (id) => {
    const row = database_1.default.prepare(`SELECT * FROM return_records WHERE id = ?`).get(id);
    if (!row) {
        throw new response_1.AppError(`退样记录 ${id} 不存在`, response_1.errorCodes.NOT_FOUND, 404);
    }
    return mapToReturnRecord(row);
};
exports.getReturnRecordById = getReturnRecordById;
const getReturnRecordsBySample = (sampleId) => {
    const rows = database_1.default.prepare(`
    SELECT * FROM return_records 
    WHERE sample_id = ? 
    ORDER BY returned_at DESC
  `).all(sampleId);
    return rows.map(mapToReturnRecord);
};
exports.getReturnRecordsBySample = getReturnRecordsBySample;
const confirmReturnReceipt = (id, operator) => {
    const record = (0, exports.getReturnRecordById)(id);
    if (record.receivedAt) {
        throw new response_1.AppError('该退样已确认签收', response_1.errorCodes.DUPLICATE_OPERATION, 400);
    }
    const now = new Date().toISOString();
    database_1.default.prepare(`
    UPDATE return_records
    SET received_by = ?, received_at = ?
    WHERE id = ?
  `).run(operator, now, id);
    const updatedRecord = (0, exports.getReturnRecordById)(id);
    (0, historyService_1.createHistoryRecord)('RETURN', id, 'UPDATE', '确认退样签收', operator, record, updatedRecord);
    return updatedRecord;
};
exports.confirmReturnReceipt = confirmReturnReceipt;
const listReturnRecords = (params = {}, page = 1, pageSize = 20) => {
    let query = `SELECT * FROM return_records WHERE 1=1`;
    const countQuery = `SELECT COUNT(*) as total FROM return_records WHERE 1=1`;
    const whereConditions = [];
    const queryParams = [];
    if (params.sampleId) {
        whereConditions.push(`sample_id = ?`);
        queryParams.push(params.sampleId);
    }
    if (params.returnType) {
        whereConditions.push(`return_type = ?`);
        queryParams.push(params.returnType);
    }
    if (params.returnedBy) {
        whereConditions.push(`returned_by LIKE ?`);
        queryParams.push(`%${params.returnedBy}%`);
    }
    if (params.startTime) {
        whereConditions.push(`returned_at >= ?`);
        queryParams.push(params.startTime);
    }
    if (params.endTime) {
        whereConditions.push(`returned_at <= ?`);
        queryParams.push(params.endTime);
    }
    if (params.isReceived !== undefined) {
        whereConditions.push(params.isReceived ? `received_at IS NOT NULL` : `received_at IS NULL`);
    }
    if (whereConditions.length > 0) {
        query += ` AND ${whereConditions.join(' AND ')}`;
    }
    const countStmt = database_1.default.prepare(whereConditions.length > 0
        ? `${countQuery} AND ${whereConditions.join(' AND ')}`
        : countQuery);
    const countResult = countStmt.get(...queryParams);
    const total = countResult.total;
    query += ` ORDER BY returned_at DESC LIMIT ? OFFSET ?`;
    const paginationParams = [...queryParams, pageSize, (page - 1) * pageSize];
    const rows = database_1.default.prepare(query).all(...paginationParams);
    return {
        items: rows.map(mapToReturnRecord),
        total
    };
};
exports.listReturnRecords = listReturnRecords;
const mapToFinalizationRecord = (row) => ({
    id: row.id,
    sampleId: row.sample_id,
    sampleNo: row.sample_no,
    finalVersion: row.final_version,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    finalQuantity: row.final_quantity,
    finalUnitPrice: row.final_unit_price,
    finalTotalAmount: row.final_total_amount,
    remarks: row.remarks,
    attachments: row.attachments ? JSON.parse(row.attachments) : undefined
});
const mapToReturnRecord = (row) => ({
    id: row.id,
    sampleId: row.sample_id,
    sampleNo: row.sample_no,
    returnType: row.return_type,
    returnReason: row.return_reason,
    returnQuantity: row.return_quantity,
    returnedBy: row.returned_by,
    returnedAt: row.returned_at,
    trackingNo: row.tracking_no,
    receivedBy: row.received_by,
    receivedAt: row.received_at,
    remarks: row.remarks
});
