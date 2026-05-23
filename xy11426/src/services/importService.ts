import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { getDatabase } from '../db/database';
import { generateId, now, fileHash, safeJsonStringify } from '../utils';
import { logAudit } from './auditService';
import { createTask } from './taskService';
import { DataSourceType, ImportStrategy, ImportOptions, RecordStatus } from '../types';

export interface ImportResult {
  batchId: string;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  strategy: ImportStrategy;
}

export interface RawRecord {
  originalLineNo: number;
  data: Record<string, any>;
}

export async function readCSV(filePath: string, skipHeader: boolean = true): Promise<RawRecord[]> {
  const records: RawRecord[] = [];
  let lineNo = skipHeader ? 2 : 1;

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        records.push({
          originalLineNo: lineNo++,
          data
        });
      })
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

export function readExcel(filePath: string): RawRecord[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  const records: RawRecord[] = [];
  const headers = jsonData[0] as string[];

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.every((cell: any) => !cell)) continue;

    const data: Record<string, any> = {};
    headers.forEach((header, idx) => {
      if (header) {
        data[header] = row[idx];
      }
    });

    records.push({
      originalLineNo: i + 1,
      data
    });
  }

  return records;
}

export function readFile(filePath: string, skipHeader: boolean = true): Promise<RawRecord[]> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.csv') {
    return readCSV(filePath, skipHeader);
  } else if (ext === '.xlsx' || ext === '.xls') {
    return Promise.resolve(readExcel(filePath));
  }
  
  throw new Error(`不支持的文件格式: ${ext}`);
}

export function mapRecord(raw: RawRecord, sourceType: DataSourceType): any {
  const data = raw.data;
  
  switch (sourceType) {
    case DataSourceType.VISITOR_APPOINTMENT:
      return {
        visitorName: data['姓名'] || data['访客姓名'] || data['name'] || '',
        visitorPhone: data['电话'] || data['手机号'] || data['phone'] || '',
        idCard: data['身份证'] || data['身份证号'] || data['idCard'] || '',
        plateNumber: data['车牌号'] || data['车牌'] || data['plate'] || '',
        visitDate: data['访问日期'] || data['日期'] || data['visitDate'] || '',
        startTime: data['开始时间'] || data['入场时间'] || data['startTime'] || '',
        endTime: data['结束时间'] || data['离场时间'] || data['endTime'] || '',
      };
    
    case DataSourceType.GATE_RECORD:
      return {
        visitorName: data['姓名'] || data['访客姓名'] || data['name'] || '',
        visitorPhone: data['电话'] || data['手机号'] || data['phone'] || '',
        plateNumber: data['车牌号'] || data['车牌'] || data['plate'] || '',
        visitDate: data['日期'] || data['通行日期'] || data['date'] || '',
        startTime: data['入场时间'] || data['通行时间'] || data['passTime'] || '',
        endTime: data['出场时间'] || data['endTime'] || data['visitDate'] || '',
        gatePassed: true,
        passTime: data['通行时间'] || data['passTime'] || '',
        gateNo: data['闸机号'] || data['gateNo'] || '',
      };
    
    case DataSourceType.TEMP_PLATE:
      return {
        visitorName: data['车主'] || data['姓名'] || data['owner'] || '',
        visitorPhone: data['联系电话'] || data['phone'] || '',
        plateNumber: data['车牌号'] || data['临时车牌'] || data['plate'] || '',
        visitDate: data['有效期开始'] || data['startDate'] || data['date'] || '',
        startTime: data['开始时间'] || '00:00:00',
        endTime: data['结束时间'] || '23:59:59',
      };
    
    case DataSourceType.REFUND_FLOW:
      return {
        visitorName: data['申请人'] || data['姓名'] || data['applicant'] || '',
        visitorPhone: data['联系电话'] || data['phone'] || '',
        visitDate: data['申请日期'] || data['refundDate'] || data['date'] || '',
        startTime: data['申请时间'] || '00:00:00',
        endTime: data['完成时间'] || '23:59:59',
      };
    
    default:
      return {};
  }
}

export function createBatch(
  filePath: string,
  options: ImportOptions
): string {
  const db = getDatabase();
  const batchId = generateId();
  const hash = fileHash(filePath);
  const fileName = path.basename(filePath);

  const existingBatch = db.prepare(`
    SELECT id FROM import_batches WHERE file_hash = ?
  `).get(hash);

  if (existingBatch && options.strategy === ImportStrategy.IGNORE) {
    throw new Error(`该文件已导入过，批次ID: ${(existingBatch as any).id}`);
  }

  const stmt = db.prepare(`
    INSERT INTO import_batches (
      id, source_type, file_name, file_hash, strategy, operator, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    batchId,
    options.sourceType,
    fileName,
    hash,
    options.strategy,
    options.operator,
    'processing',
    now(),
    now()
  );

  logAudit({
    batchId,
    operator: options.operator,
    action: 'create_batch',
    newValue: { fileName, sourceType: options.sourceType, strategy: options.strategy }
  });

  return batchId;
}

export function processImportStrategy(
  batchId: string,
  sourceType: DataSourceType,
  strategy: ImportStrategy,
  operator: string
): void {
  const db = getDatabase();

  if (strategy === ImportStrategy.OVERWRITE) {
    const batches = db.prepare(`
      SELECT id FROM import_batches 
      WHERE source_type = ? AND id != ? AND status = 'completed'
    `).all(sourceType, batchId);

    for (const batch of batches as any[]) {
      db.prepare(`
        UPDATE import_batches 
        SET status = 'overwritten', updated_at = ? 
        WHERE id = ?
      `).run(now(), batch.id);

      logAudit({
        batchId: batch.id,
        operator,
        action: 'overwrite_batch',
        oldValue: { status: 'completed' },
        newValue: { status: 'overwritten' }
      });
    }
  }
}

export function insertRecords(
  batchId: string,
  rawRecords: RawRecord[],
  sourceType: DataSourceType,
  operator: string
): { total: number; success: number; failed: number } {
  const db = getDatabase();
  let success = 0;
  let failed = 0;

  const insertStmt = db.prepare(`
    INSERT INTO visitor_records (
      id, batch_id, source_type, original_line_no, visitor_name, visitor_phone,
      id_card, plate_number, visit_date, start_time, end_time, gate_passed,
      pass_time, gate_no, status, raw_data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((records: any[]) => {
    for (const record of records) {
      insertStmt.run(
        record.id,
        record.batchId,
        record.sourceType,
        record.originalLineNo,
        record.visitorName,
        record.visitorPhone,
        record.idCard,
        record.plateNumber,
        record.visitDate,
        record.startTime,
        record.endTime,
        record.gatePassed ? 1 : 0,
        record.passTime,
        record.gateNo,
        record.status,
        record.rawData,
        record.createdAt,
        record.updatedAt
      );
    }
  });

  const recordsToInsert: any[] = [];

  for (const raw of rawRecords) {
    try {
      const mapped = mapRecord(raw, sourceType);
      
      recordsToInsert.push({
        id: generateId(),
        batchId,
        sourceType,
        originalLineNo: raw.originalLineNo,
        visitorName: mapped.visitorName || '未知',
        visitorPhone: mapped.visitorPhone || '',
        idCard: mapped.idCard || '',
        plateNumber: mapped.plateNumber || '',
        visitDate: mapped.visitDate || '',
        startTime: mapped.startTime || '',
        endTime: mapped.endTime || '',
        gatePassed: mapped.gatePassed || false,
        passTime: mapped.passTime || '',
        gateNo: mapped.gateNo || '',
        status: RecordStatus.RAW,
        rawData: safeJsonStringify(raw.data),
        createdAt: now(),
        updatedAt: now()
      });
      
      success++;
    } catch (error) {
      failed++;
    }
  }

  if (recordsToInsert.length > 0) {
    transaction(recordsToInsert);
  }

  db.prepare(`
    UPDATE import_batches 
    SET total_records = ?, status = 'imported', updated_at = ? 
    WHERE id = ?
  `).run(rawRecords.length, now(), batchId);

  logAudit({
    batchId,
    operator,
    action: 'import_records',
    newValue: { total: rawRecords.length, success, failed }
  });

  return { total: rawRecords.length, success, failed };
}

export async function importFile(
  filePath: string,
  options: ImportOptions
): Promise<ImportResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  const batchId = createBatch(filePath, options);
  
  const taskId = createTask({
    batchId,
    taskType: 'import_file',
    maxRetries: 2
  });

  try {
    const rawRecords = await readFile(filePath, options.skipHeader);
    
    processImportStrategy(batchId, options.sourceType, options.strategy, options.operator);
    
    const result = insertRecords(batchId, rawRecords, options.sourceType, options.operator);

    const db = getDatabase();
    db.prepare(`
      UPDATE import_batches 
      SET status = 'completed', updated_at = ? 
      WHERE id = ?
    `).run(now(), batchId);

    logAudit({
      batchId,
      operator: options.operator,
      action: 'complete_import',
      newValue: result
    });

    return {
      batchId,
      totalRecords: result.total,
      importedRecords: result.success,
      skippedRecords: result.failed,
      strategy: options.strategy
    };
  } catch (error) {
    const db = getDatabase();
    db.prepare(`
      UPDATE import_batches 
      SET status = 'failed', updated_at = ? 
      WHERE id = ?
    `).run(now(), batchId);

    throw error;
  }
}

export function getBatch(batchId: string): any {
  const db = getDatabase();
  return db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId);
}

export function getBatches(sourceType?: DataSourceType, limit: number = 100): any[] {
  const db = getDatabase();
  
  if (sourceType) {
    return db.prepare(`
      SELECT * FROM import_batches 
      WHERE source_type = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(sourceType, limit);
  }
  
  return db.prepare(`
    SELECT * FROM import_batches 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(limit);
}

export function getBatchRecords(batchId: string, status?: RecordStatus): any[] {
  const db = getDatabase();
  
  if (status) {
    return db.prepare(`
      SELECT * FROM visitor_records 
      WHERE batch_id = ? AND status = ? 
      ORDER BY original_line_no
    `).all(batchId, status);
  }
  
  return db.prepare(`
    SELECT * FROM visitor_records 
    WHERE batch_id = ? 
    ORDER BY original_line_no
  `).all(batchId);
}
