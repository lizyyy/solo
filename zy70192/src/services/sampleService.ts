import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { Sample, SampleStatus, PaginatedResponse } from '../types';
import { AppError, errorCodes } from '../utils/response';
import { createHistoryRecord } from './historyService';

let sampleCounter = 0;
const SAMPLE_NO_PREFIX = 'SAM';

export const generateSampleNo = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  sampleCounter++;
  const sequence = String(sampleCounter).padStart(4, '0');
  
  return `${SAMPLE_NO_PREFIX}-${year}${month}${day}-${sequence}`;
};

export const createSample = (
  data: {
    name: string;
    supplier: string;
    category: string;
    quantity: number;
    unitPrice: number;
  },
  operator: string
): Sample => {
  const sampleNo = generateSampleNo();
  const totalAmount = data.quantity * data.unitPrice;
  const now = new Date().toISOString();

  const sample: Sample = {
    id: uuidv4(),
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

  const stmt = db.prepare(`
    INSERT INTO samples (id, sample_no, name, supplier, category, quantity, unit_price, total_amount, status, version, is_frozen, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    sample.id,
    sample.sampleNo,
    sample.name,
    sample.supplier,
    sample.category,
    sample.quantity,
    sample.unitPrice,
    sample.totalAmount,
    sample.status,
    sample.version,
    sample.isFrozen ? 1 : 0,
    sample.createdBy,
    sample.createdAt,
    sample.updatedAt
  );

  createHistoryRecord(
    'SAMPLE',
    sample.id,
    'CREATE',
    `创建样品 ${sample.sampleNo}`,
    operator,
    undefined,
    sample
  );

  return sample;
};

export const getSampleById = (id: string): Sample => {
  const row = db.prepare(`SELECT * FROM samples WHERE id = ?`).get(id) as any;
  if (!row) {
    throw new AppError(`样品 ${id} 不存在`, errorCodes.NOT_FOUND, 404);
  }
  return mapToSample(row);
};

export const getSampleByNo = (sampleNo: string): Sample => {
  const row = db.prepare(`SELECT * FROM samples WHERE sample_no = ?`).get(sampleNo) as any;
  if (!row) {
    throw new AppError(`样品编号 ${sampleNo} 不存在`, errorCodes.NOT_FOUND, 404);
  }
  return mapToSample(row);
};

export const listSamples = (
  params: {
    status?: SampleStatus;
    category?: string;
    supplier?: string;
    isFrozen?: boolean;
    keyword?: string;
  } = {},
  page: number = 1,
  pageSize: number = 20
): PaginatedResponse<Sample> => {
  let query = `SELECT * FROM samples WHERE 1=1`;
  const countQuery = `SELECT COUNT(*) as total FROM samples WHERE 1=1`;
  const whereConditions: string[] = [];
  const countConditions: string[] = [];
  const queryParams: any[] = [];

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

  const countStmt = db.prepare(
    countConditions.length > 0 
      ? `${countQuery} AND ${countConditions.join(' AND ')}`
      : countQuery
  );
  const countResult = countStmt.get(...queryParams) as { total: number };
  const total = countResult.total;

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const paginationParams = [...queryParams, pageSize, (page - 1) * pageSize];

  const rows = db.prepare(query).all(...paginationParams) as any[];

  return {
    items: rows.map(mapToSample),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
};

export const updateSampleStatus = (
  id: string,
  newStatus: SampleStatus,
  operator: string
): Sample => {
  const sample = getSampleById(id);

  if (sample.isFrozen) {
    throw new AppError('样品已冻结，无法修改状态', errorCodes.SAMPLE_FROZEN, 400);
  }

  const validTransitions: Record<SampleStatus, SampleStatus[]> = {
    CREATED: ['SHIPPED'],
    SHIPPED: ['IN_TRIAL', 'RETURNED'],
    IN_TRIAL: ['PENDING_REVIEW', 'RETURNED'],
    PENDING_REVIEW: ['REVIEWED', 'IN_TRIAL'],
    REVIEWED: ['FINALIZED', 'PENDING_REVIEW', 'RETURNED'],
    FINALIZED: [],
    RETURNED: []
  };

  if (!validTransitions[sample.status].includes(newStatus)) {
    throw new AppError(
      `无效的状态转换: ${sample.status} -> ${newStatus}`,
      errorCodes.INVALID_STATUS_TRANSITION,
      400
    );
  }

  const beforeState = { ...sample };
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE samples 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(newStatus, now, id);

  const updatedSample = getSampleById(id);

  createHistoryRecord(
    'SAMPLE',
    id,
    'STATUS_CHANGE',
    `状态从 ${sample.status} 变更为 ${newStatus}`,
    operator,
    beforeState,
    updatedSample
  );

  return updatedSample;
};

export const updateSampleInfo = (
  id: string,
  data: {
    name?: string;
    supplier?: string;
    category?: string;
    quantity?: number;
    unitPrice?: number;
  },
  operator: string
): Sample => {
  const sample = getSampleById(id);

  if (sample.isFrozen) {
    throw new AppError('样品已冻结，无法修改', errorCodes.SAMPLE_FROZEN, 400);
  }

  if (sample.status === 'FINALIZED' || sample.status === 'RETURNED') {
    throw new AppError('样品已结版或退回，无法修改', errorCodes.BAD_REQUEST, 400);
  }

  const beforeState = { ...sample };
  const updates: string[] = [];
  const params: any[] = [];

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
      throw new AppError('数量不能为负数', errorCodes.VALIDATION_ERROR, 400);
    }
    newQuantity = data.quantity;
    updates.push('quantity = ?');
    params.push(data.quantity);
  }

  if (data.unitPrice !== undefined) {
    if (data.unitPrice < 0) {
      throw new AppError('单价不能为负数', errorCodes.VALIDATION_ERROR, 400);
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

  db.prepare(`UPDATE samples SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updatedSample = getSampleById(id);

  createHistoryRecord(
    'SAMPLE',
    id,
    'UPDATE',
    '更新样品信息',
    operator,
    beforeState,
    updatedSample
  );

  return updatedSample;
};

export const freezeSample = (id: string, operator: string): Sample => {
  const sample = getSampleById(id);

  if (sample.isFrozen) {
    return sample;
  }

  const beforeState = { ...sample };
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE samples 
    SET is_frozen = 1, frozen_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, id);

  const updatedSample = getSampleById(id);

  createHistoryRecord(
    'SAMPLE',
    id,
    'FREEZE',
    '冻结样品',
    operator,
    beforeState,
    updatedSample
  );

  return updatedSample;
};

export const unfreezeSample = (id: string, operator: string): Sample => {
  const sample = getSampleById(id);

  if (!sample.isFrozen) {
    return sample;
  }

  const beforeState = { ...sample };
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE samples 
    SET is_frozen = 0, frozen_at = NULL, updated_at = ?
    WHERE id = ?
  `).run(now, id);

  const updatedSample = getSampleById(id);

  createHistoryRecord(
    'SAMPLE',
    id,
    'UNFREEZE',
    '解冻样品',
    operator,
    beforeState,
    updatedSample
  );

  return updatedSample;
};

export const getSampleSummary = (): {
  total: number;
  byStatus: Record<SampleStatus, number>;
  totalAmount: number;
  totalQuantity: number;
} => {
  const result = db.prepare(`
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
  `).get() as any;

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

const mapToSample = (row: any): Sample => ({
  id: row.id,
  sampleNo: row.sample_no,
  name: row.name,
  supplier: row.supplier,
  category: row.category,
  quantity: row.quantity,
  unitPrice: row.unit_price,
  totalAmount: row.total_amount,
  status: row.status as SampleStatus,
  version: row.version,
  isFrozen: row.is_frozen === 1,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  frozenAt: row.frozen_at
});
