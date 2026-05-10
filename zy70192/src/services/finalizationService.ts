import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { FinalizationRecord, ReturnRecord, ReturnType } from '../types';
import { AppError, errorCodes } from '../utils/response';
import { createHistoryRecord } from './historyService';
import { getSampleById, updateSampleStatus, freezeSample, updateSampleInfo } from './sampleService';

export const finalizeSample = (
  data: {
    sampleId: string;
    finalQuantity: number;
    finalUnitPrice: number;
    remarks?: string;
    attachments?: string[];
  },
  operator: string
): FinalizationRecord => {
  const sample = getSampleById(data.sampleId);

  if (sample.status !== 'REVIEWED') {
    throw new AppError('只有评审完成的样品才能定版', errorCodes.BAD_REQUEST, 400);
  }

  if (data.finalQuantity < 0) {
    throw new AppError('最终数量不能为负数', errorCodes.VALIDATION_ERROR, 400);
  }

  if (data.finalUnitPrice < 0) {
    throw new AppError('最终单价不能为负数', errorCodes.VALIDATION_ERROR, 400);
  }

  const finalTotalAmount = data.finalQuantity * data.finalUnitPrice;
  const now = new Date().toISOString();

  const record: FinalizationRecord = {
    id: uuidv4(),
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

  const stmt = db.prepare(`
    INSERT INTO finalization_records (id, sample_id, sample_no, final_version, approved_by, approved_at, final_quantity, final_unit_price, final_total_amount, remarks, attachments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    record.id,
    record.sampleId,
    record.sampleNo,
    record.finalVersion,
    record.approvedBy,
    record.approvedAt,
    record.finalQuantity,
    record.finalUnitPrice,
    record.finalTotalAmount,
    record.remarks || null,
    record.attachments ? JSON.stringify(record.attachments) : null
  );

  updateSampleStatus(data.sampleId, 'FINALIZED', operator);
  
  updateSampleInfo(data.sampleId, {
    quantity: data.finalQuantity,
    unitPrice: data.finalUnitPrice
  }, operator);

  freezeSample(data.sampleId, operator);

  createHistoryRecord(
    'FINALIZATION',
    record.id,
    'CREATE',
    `样品定版冻结 - 版本 ${record.finalVersion}`,
    operator,
    undefined,
    record
  );

  return record;
};

export const getFinalizationById = (id: string): FinalizationRecord => {
  const row = db.prepare(`SELECT * FROM finalization_records WHERE id = ?`).get(id) as any;
  if (!row) {
    throw new AppError(`定版记录 ${id} 不存在`, errorCodes.NOT_FOUND, 404);
  }
  return mapToFinalizationRecord(row);
};

export const getFinalizationBySample = (sampleId: string): FinalizationRecord | null => {
  const row = db.prepare(`SELECT * FROM finalization_records WHERE sample_id = ? ORDER BY approved_at DESC LIMIT 1`).get(sampleId) as any;
  return row ? mapToFinalizationRecord(row) : null;
};

export const listFinalizations = (
  params: {
    sampleId?: string;
    approvedBy?: string;
    startTime?: string;
    endTime?: string;
  } = {},
  page: number = 1,
  pageSize: number = 20
): { items: FinalizationRecord[], total: number } => {
  let query = `SELECT * FROM finalization_records WHERE 1=1`;
  const countQuery = `SELECT COUNT(*) as total FROM finalization_records WHERE 1=1`;
  const whereConditions: string[] = [];
  const queryParams: any[] = [];

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

  const countStmt = db.prepare(
    whereConditions.length > 0 
      ? `${countQuery} AND ${whereConditions.join(' AND ')}`
      : countQuery
  );
  const countResult = countStmt.get(...queryParams) as { total: number };
  const total = countResult.total;

  query += ` ORDER BY approved_at DESC LIMIT ? OFFSET ?`;
  const paginationParams = [...queryParams, pageSize, (page - 1) * pageSize];

  const rows = db.prepare(query).all(...paginationParams) as any[];

  return {
    items: rows.map(mapToFinalizationRecord),
    total
  };
};

export const createReturnRecord = (
  data: {
    sampleId: string;
    returnType: ReturnType;
    returnReason: string;
    returnQuantity: number;
    trackingNo?: string;
    remarks?: string;
  },
  operator: string
): ReturnRecord => {
  const sample = getSampleById(data.sampleId);

  if (sample.isFrozen) {
    throw new AppError('样品已冻结，无法退样', errorCodes.SAMPLE_FROZEN, 400);
  }

  if (sample.status === 'FINALIZED') {
    throw new AppError('已结版的样品无法退样', errorCodes.BAD_REQUEST, 400);
  }

  if (data.returnQuantity <= 0) {
    throw new AppError('退样数量必须大于 0', errorCodes.VALIDATION_ERROR, 400);
  }

  if (data.returnQuantity > sample.quantity) {
    throw new AppError(`退样数量不能超过样品数量 ${sample.quantity}`, errorCodes.VALIDATION_ERROR, 400);
  }

  const now = new Date().toISOString();

  const record: ReturnRecord = {
    id: uuidv4(),
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

  const stmt = db.prepare(`
    INSERT INTO return_records (id, sample_id, sample_no, return_type, return_reason, return_quantity, returned_by, returned_at, tracking_no, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    record.id,
    record.sampleId,
    record.sampleNo,
    record.returnType,
    record.returnReason,
    record.returnQuantity,
    record.returnedBy,
    record.returnedAt,
    record.trackingNo || null,
    record.remarks || null
  );

  const remainingQuantity = sample.quantity - data.returnQuantity;
  if (remainingQuantity === 0) {
    updateSampleStatus(data.sampleId, 'RETURNED', operator);
  } else {
    updateSampleInfo(data.sampleId, { quantity: remainingQuantity }, operator);
  }

  createHistoryRecord(
    'RETURN',
    record.id,
    'CREATE',
    `退样记录 - ${record.returnType}，数量: ${record.returnQuantity}`,
    operator,
    undefined,
    record
  );

  return record;
};

export const getReturnRecordById = (id: string): ReturnRecord => {
  const row = db.prepare(`SELECT * FROM return_records WHERE id = ?`).get(id) as any;
  if (!row) {
    throw new AppError(`退样记录 ${id} 不存在`, errorCodes.NOT_FOUND, 404);
  }
  return mapToReturnRecord(row);
};

export const getReturnRecordsBySample = (sampleId: string): ReturnRecord[] => {
  const rows = db.prepare(`
    SELECT * FROM return_records 
    WHERE sample_id = ? 
    ORDER BY returned_at DESC
  `).all(sampleId) as any[];
  return rows.map(mapToReturnRecord);
};

export const confirmReturnReceipt = (
  id: string,
  operator: string
): ReturnRecord => {
  const record = getReturnRecordById(id);

  if (record.receivedAt) {
    throw new AppError('该退样已确认签收', errorCodes.DUPLICATE_OPERATION, 400);
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE return_records
    SET received_by = ?, received_at = ?
    WHERE id = ?
  `).run(operator, now, id);

  const updatedRecord = getReturnRecordById(id);

  createHistoryRecord(
    'RETURN',
    id,
    'UPDATE',
    '确认退样签收',
    operator,
    record,
    updatedRecord
  );

  return updatedRecord;
};

export const listReturnRecords = (
  params: {
    sampleId?: string;
    returnType?: ReturnType;
    returnedBy?: string;
    startTime?: string;
    endTime?: string;
    isReceived?: boolean;
  } = {},
  page: number = 1,
  pageSize: number = 20
): { items: ReturnRecord[], total: number } => {
  let query = `SELECT * FROM return_records WHERE 1=1`;
  const countQuery = `SELECT COUNT(*) as total FROM return_records WHERE 1=1`;
  const whereConditions: string[] = [];
  const queryParams: any[] = [];

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

  const countStmt = db.prepare(
    whereConditions.length > 0 
      ? `${countQuery} AND ${whereConditions.join(' AND ')}`
      : countQuery
  );
  const countResult = countStmt.get(...queryParams) as { total: number };
  const total = countResult.total;

  query += ` ORDER BY returned_at DESC LIMIT ? OFFSET ?`;
  const paginationParams = [...queryParams, pageSize, (page - 1) * pageSize];

  const rows = db.prepare(query).all(...paginationParams) as any[];

  return {
    items: rows.map(mapToReturnRecord),
    total
  };
};

const mapToFinalizationRecord = (row: any): FinalizationRecord => ({
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

const mapToReturnRecord = (row: any): ReturnRecord => ({
  id: row.id,
  sampleId: row.sample_id,
  sampleNo: row.sample_no,
  returnType: row.return_type as ReturnType,
  returnReason: row.return_reason,
  returnQuantity: row.return_quantity,
  returnedBy: row.returned_by,
  returnedAt: row.returned_at,
  trackingNo: row.tracking_no,
  receivedBy: row.received_by,
  receivedAt: row.received_at,
  remarks: row.remarks
});
