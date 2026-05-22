import { getDatabase } from '../database/init.js';
import crypto from 'crypto';
import { BatchStatus, Role } from '../../shared/types.js';
import { getNextStatus, BatchEvent } from './stateMachine.js';
import { createAuditLog } from './auditService.js';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export interface CreateBatchOptions {
  title: string;
  remark: string;
  createdBy: string;
  createdByName: string;
  files?: Express.Multer.File[];
  ipAddress?: string;
  userAgent?: string;
}

export interface FailedRecord {
  rowNumber: number;
  reason: string;
  originalValue: string;
}

export function generateBatchNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomInt(1000, 9999);
  return `B${dateStr}${random}`;
}

export function createBatch(options: CreateBatchOptions) {
  const db = getDatabase();
  
  let batchNo: string;
  let attempts = 0;
  do {
    batchNo = generateBatchNo();
    const existing = db.prepare('SELECT id FROM batches WHERE batch_no = ?').get(batchNo);
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    db.close();
    throw new Error('生成批次号失败，请重试');
  }

  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();

  const insertBatch = db.prepare(`
    INSERT INTO batches (
      id, batch_no, version, status, title, remark,
      created_by, created_at, updated_at
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
  `);

  insertBatch.run(
    batchId, batchNo, BatchStatus.PENDING_SUBMIT,
    options.title, options.remark,
    options.createdBy, now, now
  );

  let parsedRecords = 0;
  const failedRecords: FailedRecord[] = [];

  if (options.files && options.files.length > 0) {
    for (const file of options.files) {
      const fileExt = path.extname(file.originalname).toLowerCase();
      
      if (fileExt === '.xlsx' || fileExt === '.xls') {
        try {
          const workbook = XLSX.readFile(file.path);
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          const insertRawData = db.prepare(`
            INSERT INTO raw_data_records (
              id, batch_id, source_file, original_row_number,
              field_name, original_value, parsed_value, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (let i = 0; i < data.length; i++) {
            const row = data[i] as any[];
            if (row.length === 0 || row.every(cell => cell === undefined || cell === null || cell === '')) {
              continue;
            }

            for (let j = 0; j < row.length; j++) {
              const originalValue = String(row[j] ?? '');
              let parsedValue = originalValue.trim();

              if (i === 0) {
                parsedValue = parsedValue || `列${j + 1}`;
              }

              insertRawData.run(
                crypto.randomUUID(),
                batchId,
                file.originalname,
                i + 1,
                i === 0 ? '表头' : `字段${j + 1}`,
                originalValue,
                parsedValue,
                now
              );
              parsedRecords++;
            }
          }
        } catch (error) {
          failedRecords.push({
            rowNumber: 0,
            reason: `文件解析失败: ${(error as Error).message}`,
            originalValue: file.originalname
          });
        }
      }

      saveAttachment(batchId, file, options.createdBy, db);
    }
  }

  createAuditLog({
    userId: options.createdBy,
    userName: options.createdByName,
    action: 'batch:create',
    resourceType: 'batch',
    resourceId: batchId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    success: true
  });

  db.close();

  return {
    batchId,
    batchNo,
    parsedRecords,
    failedRecords
  };
}

function saveAttachment(
  batchId: string,
  file: Express.Multer.File,
  uploadedBy: string,
  db: any
) {
  const fileTypeMap: Record<string, string> = {
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.gif': 'image',
    '.xlsx': 'excel',
    '.xls': 'excel',
    '.pdf': 'pdf'
  };

  const ext = path.extname(file.originalname).toLowerCase();
  const fileType = (fileTypeMap[ext] || 'other') as any;

  const uploadDir = path.join(process.cwd(), 'uploads', batchId);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const newFilename = `${crypto.randomUUID()}${ext}`;
  const newPath = path.join(uploadDir, newFilename);
  fs.renameSync(file.path, newPath);

  const stmt = db.prepare(`
    INSERT INTO attachments (
      id, batch_id, file_name, file_type, file_size,
      storage_path, uploaded_by, uploaded_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  stmt.run(
    crypto.randomUUID(),
    batchId,
    file.originalname,
    fileType,
    file.size,
    path.join(batchId, newFilename),
    uploadedBy,
    new Date().toISOString()
  );
}

export function getBatchById(batchId: string) {
  const db = getDatabase();
  
  const batch = db.prepare(`
    SELECT b.*, u1.real_name as created_by_name, u2.real_name as frozen_by_name
    FROM batches b
    LEFT JOIN users u1 ON b.created_by = u1.id
    LEFT JOIN users u2 ON b.frozen_by = u2.id
    WHERE b.id = ?
  `).get(batchId) as any;

  if (!batch) {
    db.close();
    return null;
  }

  const rawData = db.prepare(`
    SELECT * FROM raw_data_records WHERE batch_id = ? ORDER BY original_row_number, field_name
  `).all(batchId);

  const transitions = db.prepare(`
    SELECT st.*, u.real_name as operated_by_name
    FROM status_transitions st
    LEFT JOIN users u ON st.operated_by = u.id
    WHERE st.batch_id = ? ORDER BY operated_at
  `).all(batchId);

  const reviewRecords = db.prepare(`
    SELECT rr.*, u.real_name as reviewed_by_name
    FROM review_records rr
    LEFT JOIN users u ON rr.reviewed_by = u.id
    WHERE rr.batch_id = ? ORDER BY reviewed_at
  `).all(batchId);

  const attachments = db.prepare(`
    SELECT a.*, u.real_name as uploaded_by_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    WHERE a.batch_id = ? ORDER BY uploaded_at
  `).all(batchId);

  db.close();

  return {
    batch: {
      ...batch,
      createdByName: batch.created_by_name,
      frozenByName: batch.frozen_by_name
    },
    rawData,
    transitions,
    reviewRecords,
    attachments
  };
}

export function getBatches(
  page: number = 1,
  pageSize: number = 20,
  filters?: {
    status?: BatchStatus;
    createdBy?: string;
    keyword?: string;
  }
) {
  const db = getDatabase();
  
  let whereClauses: string[] = [];
  let params: any[] = [];

  if (filters?.status) {
    whereClauses.push('b.status = ?');
    params.push(filters.status);
  }
  if (filters?.createdBy) {
    whereClauses.push('b.created_by = ?');
    params.push(filters.createdBy);
  }
  if (filters?.keyword) {
    whereClauses.push('(b.title LIKE ? OR b.batch_no LIKE ? OR b.remark LIKE ?)');
    const keyword = `%${filters.keyword}%`;
    params.push(keyword, keyword, keyword);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countStmt = db.prepare(`
    SELECT COUNT(*) as total FROM batches b ${whereSql}
  `);
  const totalResult = countStmt.get(...params) as { total: number };

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);

  const batchesStmt = db.prepare(`
    SELECT b.*, u.real_name as created_by_name
    FROM batches b
    LEFT JOIN users u ON b.created_by = u.id
    ${whereSql}
    ORDER BY b.created_at DESC LIMIT ? OFFSET ?
  `);

  const batches = batchesStmt.all(...params).map((b: any) => ({
    ...b,
    createdByName: b.created_by_name
  }));

  db.close();

  return {
    batches,
    total: totalResult.total,
    page,
    pageSize,
    totalPages: Math.ceil(totalResult.total / pageSize)
  };
}

export function transitionBatchStatus(
  batchId: string,
  event: BatchEvent['type'],
  operatedBy: string,
  operatedByName: string,
  reason?: string,
  ipAddress?: string
) {
  const db = getDatabase();
  
  const batch = db.prepare('SELECT status FROM batches WHERE id = ?').get(batchId) as any;
  if (!batch) {
    db.close();
    throw new Error('批次不存在');
  }

  const nextStatus = getNextStatus(batch.status as BatchStatus, event);
  if (!nextStatus) {
    db.close();
    throw new Error(`无法从 ${batch.status} 状态执行 ${event} 操作`);
  }

  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO status_transitions (
      id, batch_id, from_status, to_status, transition_type,
      reason, operated_by, operated_at, ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    batchId,
    batch.status,
    nextStatus,
    'manual',
    reason || null,
    operatedBy,
    now,
    ipAddress || null
  );

  db.prepare(`
    UPDATE batches SET status = ?, updated_at = ? WHERE id = ?
  `).run(nextStatus, now, batchId);

  createAuditLog({
    userId: operatedBy,
    userName: operatedByName,
    action: `batch:${event.toLowerCase()}`,
    resourceType: 'batch',
    resourceId: batchId,
    ipAddress,
    success: true
  });

  db.close();

  return {
    previousStatus: batch.status,
    newStatus: nextStatus
  };
}

export function withdrawBatch(
  batchId: string,
  operatedBy: string,
  operatedByName: string,
  reason: string,
  ipAddress?: string
) {
  return transitionBatchStatus(
    batchId,
    'WITHDRAW',
    operatedBy,
    operatedByName,
    reason,
    ipAddress
  );
}

export function resubmitBatch(
  originalBatchId: string,
  title: string,
  remark: string,
  operatedBy: string,
  operatedByName: string,
  ipAddress?: string
) {
  const db = getDatabase();
  
  const originalBatch = db.prepare(`
    SELECT * FROM batches WHERE id = ?
  `).get(originalBatchId) as any;

  if (!originalBatch) {
    db.close();
    throw new Error('原始批次不存在');
  }

  if (originalBatch.status !== BatchStatus.WITHDRAWN) {
    db.close();
    throw new Error('只有已撤回的批次才能重新提交');
  }

  const newBatchNo = generateBatchNo();
  const newBatchId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO batches (
      id, batch_no, version, parent_batch_id, status,
      title, remark, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newBatchId,
    newBatchNo,
    (originalBatch.version || 1) + 1,
    originalBatchId,
    BatchStatus.PROCESSING,
    title || originalBatch.title,
    remark || originalBatch.remark,
    operatedBy,
    now,
    now
  );

  const rawDataRecords = db.prepare(`
    SELECT * FROM raw_data_records WHERE batch_id = ?
  `).all(originalBatchId);

  const insertRawData = db.prepare(`
    INSERT INTO raw_data_records (
      id, batch_id, source_file, original_row_number,
      field_name, original_value, parsed_value, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const record of rawDataRecords) {
    insertRawData.run(
      crypto.randomUUID(),
      newBatchId,
      (record as any).source_file,
      (record as any).original_row_number,
      (record as any).field_name,
      (record as any).original_value,
      (record as any).parsed_value,
      now
    );
  }

  db.prepare(`
    INSERT INTO status_transitions (
      id, batch_id, from_status, to_status, transition_type,
      reason, operated_by, operated_at, ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    newBatchId,
    BatchStatus.PENDING_SUBMIT,
    BatchStatus.PROCESSING,
    'manual',
    '撤回后重新提交',
    operatedBy,
    now,
    ipAddress || null
  );

  createAuditLog({
    userId: operatedBy,
    userName: operatedByName,
    action: 'batch:resubmit',
    resourceType: 'batch',
    resourceId: newBatchId,
    ipAddress,
    success: true
  });

  db.close();

  return {
    batchId: newBatchId,
    batchNo: newBatchNo,
    version: (originalBatch.version || 1) + 1,
    parentBatchId: originalBatchId
  };
}

export function addAttachment(
  batchId: string,
  file: Express.Multer.File,
  uploadedBy: string,
  uploadedByName: string,
  ipAddress?: string
) {
  const db = getDatabase();
  
  const batch = db.prepare('SELECT status FROM batches WHERE id = ?').get(batchId);
  if (!batch) {
    db.close();
    throw new Error('批次不存在');
  }

  saveAttachment(batchId, file, uploadedBy, db);

  createAuditLog({
    userId: uploadedBy,
    userName: uploadedByName,
    action: 'batch:attach',
    resourceType: 'batch',
    resourceId: batchId,
    ipAddress,
    success: true
  });

  db.close();
}
