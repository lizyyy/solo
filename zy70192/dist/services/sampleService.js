"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSampleSummary = exports.unfreezeSample = exports.freezeSample = exports.updateSampleInfo = exports.updateSampleStatus = exports.listSamples = exports.getSampleByNo = exports.getSampleById = exports.createSample = exports.generateSampleNo = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
const historyService_1 = require("./historyService");
let sampleCounter = 0;
const SAMPLE_NO_PREFIX = 'SAM';
const generateSampleNo = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    sampleCounter++;
    const sequence = String(sampleCounter).padStart(4, '0');
    return `${SAMPLE_NO_PREFIX}-${year}${month}${day}-${sequence}`;
};
exports.generateSampleNo = generateSampleNo;
const createSample = (data, operator) => {
    const sampleNo = (0, exports.generateSampleNo)();
    const totalAmount = data.quantity * data.unitPrice;
    const now = new Date().toISOString();
    const sample = {
        id: (0, uuid_1.v4)(),
        sampleNo,
        name: data.name,
        supplier: data.supplier,
        category: data.category,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalAmount,
        status: 'CREATED',
        version: 1,
        isFrozen: false,
        createdBy: operator,
        createdAt: now,
        updatedAt: now
    };
    const stmt = database_1.default.prepare(`
    INSERT INTO samples (id, sample_no, name, supplier, category, quantity, unit_price, total_amount, status, version, is_frozen, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(sample.id, sample.sampleNo, sample.name, sample.supplier, sample.category, sample.quantity, sample.unitPrice, sample.totalAmount, sample.status, sample.version, sample.isFrozen ? 1 : 0, sample.createdBy, sample.createdAt, sample.updatedAt);
    (0, historyService_1.createHistoryRecord)('SAMPLE', sample.id, 'CREATE', `创建样品 ${sample.sampleNo}`, operator, undefined, sample);
    return sample;
};
exports.createSample = createSample;
const getSampleById = (id) => {
    const row = database_1.default.prepare(`SELECT * FROM samples WHERE id = ?`).get(id);
    if (!row) {
        throw new response_1.AppError(`样品 ${id} 不存在`, response_1.errorCodes.NOT_FOUND, 404);
    }
    return mapToSample(row);
};
exports.getSampleById = getSampleById;
const getSampleByNo = (sampleNo) => {
    const row = database_1.default.prepare(`SELECT * FROM samples WHERE sample_no = ?`).get(sampleNo);
    if (!row) {
        throw new response_1.AppError(`样品编号 ${sampleNo} 不存在`, response_1.errorCodes.NOT_FOUND, 404);
    }
    return mapToSample(row);
};
exports.getSampleByNo = getSampleByNo;
const listSamples = (params = {}, page = 1, pageSize = 20) => {
    let query = `SELECT * FROM samples WHERE 1=1`;
    const countQuery = `SELECT COUNT(*) as total FROM samples WHERE 1=1`;
    const whereConditions = [];
    const countConditions = [];
    const queryParams = [];
    if (params.status) {
        whereConditions.push(`status = ?`);
        countConditions.push(`status = ?`);
        queryParams.push(params.status);
    }
    if (params.category) {
        whereConditions.push(`category = ?`);
        countConditions.push(`category = ?`);
        queryParams.push(params.category);
    }
    if (params.supplier) {
        whereConditions.push(`supplier LIKE ?`);
        countConditions.push(`supplier LIKE ?`);
        queryParams.push(`%${params.supplier}%`);
    }
    if (params.isFrozen !== undefined) {
        whereConditions.push(`is_frozen = ?`);
        countConditions.push(`is_frozen = ?`);
        queryParams.push(params.isFrozen ? 1 : 0);
    }
    if (params.keyword) {
        const keywordCondition = `(name LIKE ? OR sample_no LIKE ?)`;
        whereConditions.push(keywordCondition);
        countConditions.push(keywordCondition);
        queryParams.push(`%${params.keyword}%`, `%${params.keyword}%`);
    }
    if (whereConditions.length > 0) {
        query += ` AND ${whereConditions.join(' AND ')}`;
    }
    const countStmt = database_1.default.prepare(countConditions.length > 0
        ? `${countQuery} AND ${countConditions.join(' AND ')}`
        : countQuery);
    const countResult = countStmt.get(...queryParams);
    const total = countResult.total;
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const paginationParams = [...queryParams, pageSize, (page - 1) * pageSize];
    const rows = database_1.default.prepare(query).all(...paginationParams);
    return {
        items: rows.map(mapToSample),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
};
exports.listSamples = listSamples;
const updateSampleStatus = (id, newStatus, operator) => {
    const sample = (0, exports.getSampleById)(id);
    if (sample.isFrozen) {
        throw new response_1.AppError('样品已冻结，无法修改状态', response_1.errorCodes.SAMPLE_FROZEN, 400);
    }
    const validTransitions = {
        CREATED: ['SHIPPED'],
        SHIPPED: ['IN_TRIAL', 'RETURNED'],
        IN_TRIAL: ['PENDING_REVIEW', 'RETURNED'],
        PENDING_REVIEW: ['REVIEWED', 'IN_TRIAL'],
        REVIEWED: ['FINALIZED', 'PENDING_REVIEW', 'RETURNED'],
        FINALIZED: [],
        RETURNED: []
    };
    if (!validTransitions[sample.status].includes(newStatus)) {
        throw new response_1.AppError(`无效的状态转换: ${sample.status} -> ${newStatus}`, response_1.errorCodes.INVALID_STATUS_TRANSITION, 400);
    }
    const beforeState = { ...sample };
    const now = new Date().toISOString();
    database_1.default.prepare(`
    UPDATE samples 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(newStatus, now, id);
    const updatedSample = (0, exports.getSampleById)(id);
    (0, historyService_1.createHistoryRecord)('SAMPLE', id, 'STATUS_CHANGE', `状态从 ${sample.status} 变更为 ${newStatus}`, operator, beforeState, updatedSample);
    return updatedSample;
};
exports.updateSampleStatus = updateSampleStatus;
const updateSampleInfo = (id, data, operator) => {
    const sample = (0, exports.getSampleById)(id);
    if (sample.isFrozen) {
        throw new response_1.AppError('样品已冻结，无法修改', response_1.errorCodes.SAMPLE_FROZEN, 400);
    }
    if (sample.status === 'FINALIZED' || sample.status === 'RETURNED') {
        throw new response_1.AppError('样品已结版或退回，无法修改', response_1.errorCodes.BAD_REQUEST, 400);
    }
    const beforeState = { ...sample };
    const updates = [];
    const params = [];
    if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
    }
    if (data.supplier !== undefined) {
        updates.push('supplier = ?');
        params.push(data.supplier);
    }
    if (data.category !== undefined) {
        updates.push('category = ?');
        params.push(data.category);
    }
    let newQuantity = sample.quantity;
    let newUnitPrice = sample.unitPrice;
    if (data.quantity !== undefined) {
        if (data.quantity < 0) {
            throw new response_1.AppError('数量不能为负数', response_1.errorCodes.VALIDATION_ERROR, 400);
        }
        newQuantity = data.quantity;
        updates.push('quantity = ?');
        params.push(data.quantity);
    }
    if (data.unitPrice !== undefined) {
        if (data.unitPrice < 0) {
            throw new response_1.AppError('单价不能为负数', response_1.errorCodes.VALIDATION_ERROR, 400);
        }
        newUnitPrice = data.unitPrice;
        updates.push('unit_price = ?');
        params.push(data.unitPrice);
    }
    if (data.quantity !== undefined || data.unitPrice !== undefined) {
        updates.push('total_amount = ?');
        params.push(newQuantity * newUnitPrice);
    }
    if (updates.length === 0) {
        return sample;
    }
    updates.push('version = version + 1');
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    database_1.default.prepare(`UPDATE samples SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const updatedSample = (0, exports.getSampleById)(id);
    (0, historyService_1.createHistoryRecord)('SAMPLE', id, 'UPDATE', '更新样品信息', operator, beforeState, updatedSample);
    return updatedSample;
};
exports.updateSampleInfo = updateSampleInfo;
const freezeSample = (id, operator) => {
    const sample = (0, exports.getSampleById)(id);
    if (sample.isFrozen) {
        return sample;
    }
    const beforeState = { ...sample };
    const now = new Date().toISOString();
    database_1.default.prepare(`
    UPDATE samples 
    SET is_frozen = 1, frozen_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, id);
    const updatedSample = (0, exports.getSampleById)(id);
    (0, historyService_1.createHistoryRecord)('SAMPLE', id, 'FREEZE', '冻结样品', operator, beforeState, updatedSample);
    return updatedSample;
};
exports.freezeSample = freezeSample;
const unfreezeSample = (id, operator) => {
    const sample = (0, exports.getSampleById)(id);
    if (!sample.isFrozen) {
        return sample;
    }
    const beforeState = { ...sample };
    const now = new Date().toISOString();
    database_1.default.prepare(`
    UPDATE samples 
    SET is_frozen = 0, frozen_at = NULL, updated_at = ?
    WHERE id = ?
  `).run(now, id);
    const updatedSample = (0, exports.getSampleById)(id);
    (0, historyService_1.createHistoryRecord)('SAMPLE', id, 'UNFREEZE', '解冻样品', operator, beforeState, updatedSample);
    return updatedSample;
};
exports.unfreezeSample = unfreezeSample;
const getSampleSummary = () => {
    const result = database_1.default.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(total_amount) as totalAmount,
      SUM(quantity) as totalQuantity,
      SUM(CASE WHEN status = 'CREATED' THEN 1 ELSE 0 END) as created,
      SUM(CASE WHEN status = 'SHIPPED' THEN 1 ELSE 0 END) as shipped,
      SUM(CASE WHEN status = 'IN_TRIAL' THEN 1 ELSE 0 END) as inTrial,
      SUM(CASE WHEN status = 'PENDING_REVIEW' THEN 1 ELSE 0 END) as pendingReview,
      SUM(CASE WHEN status = 'REVIEWED' THEN 1 ELSE 0 END) as reviewed,
      SUM(CASE WHEN status = 'FINALIZED' THEN 1 ELSE 0 END) as finalized,
      SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END) as returned
    FROM samples
  `).get();
    return {
        total: result.total || 0,
        byStatus: {
            CREATED: result.created || 0,
            SHIPPED: result.shipped || 0,
            IN_TRIAL: result.inTrial || 0,
            PENDING_REVIEW: result.pendingReview || 0,
            REVIEWED: result.reviewed || 0,
            FINALIZED: result.finalized || 0,
            RETURNED: result.returned || 0
        },
        totalAmount: result.totalAmount || 0,
        totalQuantity: result.totalQuantity || 0
    };
};
exports.getSampleSummary = getSampleSummary;
const mapToSample = (row) => ({
    id: row.id,
    sampleNo: row.sample_no,
    name: row.name,
    supplier: row.supplier,
    category: row.category,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    totalAmount: row.total_amount,
    status: row.status,
    version: row.version,
    isFrozen: row.is_frozen === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    frozenAt: row.frozen_at
});
