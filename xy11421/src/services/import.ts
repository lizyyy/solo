import fs from 'fs';
import csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import {
  InspectionRecord,
  RepairQuoteRecord,
  PhotoListRecord,
  ShiftRecord,
  ManualPriceRecord,
  ImportResult,
  SourceType,
  RecordStatus
} from '../types';
import {
  checkMissingFields,
  checkCrossDate,
  checkNameChanged,
  checkAmountConflict,
  saveDirtyRecord
} from './dirtyCheck';
import { recordHistory } from './history';

export interface ImportOptions {
  sourceType: SourceType;
  filePath: string;
  userId: string;
  skipCheck?: boolean;
}

export async function importData(options: ImportOptions): Promise<ImportResult> {
  const { sourceType, filePath, userId, skipCheck = false } = options;

  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  const batchId = uuidv4();
  const records: any[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => records.push(data))
      .on('end', () => resolve())
      .on('error', reject);
  });

  const result: ImportResult = {
    success: 0,
    failed: 0,
    dirty: 0,
    batchId,
    failedRecords: []
  };

  const db = await getDatabase();

  await db.run(`
    INSERT INTO import_batches (id, sourceType, fileName, totalCount, importedBy)
    VALUES (?, ?, ?, ?, ?)
  `, [batchId, sourceType, filePath, records.length, userId]);

  for (let i = 0; i < records.length; i++) {
    const row = i + 2;
    const rawData = records[i];

    try {
      const importFn = getImportFunction(sourceType);
      const { record, id, status } = await importFn(rawData, row, filePath, batchId, userId, skipCheck);

      if (status === 'dirty') {
        result.dirty++;
      } else {
        result.success++;
      }

      await recordHistory(
        sourceType,
        id,
        'import',
        null,
        record,
        userId,
        `从文件 ${filePath} 第${row}行导入`
      );
    } catch (error: any) {
      result.failed++;
      result.failedRecords.push({
        row,
        reason: error.message,
        data: rawData
      });
    }
  }

  await db.run(`
    UPDATE import_batches
    SET successCount = ?, failedCount = ?, dirtyCount = ?
    WHERE id = ?
  `, [result.success, result.failed, result.dirty, batchId]);

  return result;
}

function getImportFunction(sourceType: SourceType) {
  switch (sourceType) {
    case 'inspection':
      return importInspection;
    case 'repair_quote':
      return importRepairQuote;
    case 'photo_list':
      return importPhotoList;
    case 'shift_record':
      return importShiftRecord;
    case 'manual_price':
      return importManualPrice;
    default:
      throw new Error(`不支持的数据源类型: ${sourceType}`);
  }
}

async function importInspection(
  rawData: any,
  sourceRow: number,
  sourceFile: string,
  batchId: string,
  userId: string,
  skipCheck: boolean
): Promise<{ record: InspectionRecord; id: string; status: RecordStatus }> {
  const db = await getDatabase();

  const requiredFields = ['vin', 'carModel', 'inspectionDate', 'estimatedCost'];
  const missingCheck = checkMissingFields(rawData, requiredFields);
  if (missingCheck && !skipCheck) {
    throw new Error(missingCheck.description);
  }

  const record: InspectionRecord = {
    id: uuidv4(),
    vin: String(rawData.vin || '').trim(),
    carModel: String(rawData.carModel || '').trim(),
    plateNumber: String(rawData.plateNumber || '').trim(),
    inspector: String(rawData.inspector || '').trim(),
    inspectionDate: String(rawData.inspectionDate || '').trim(),
    mileage: parseInt(rawData.mileage) || 0,
    items: String(rawData.items || '').trim(),
    estimatedCost: parseFloat(rawData.estimatedCost) || 0,
    sourceRow,
    sourceFile,
    status: 'imported',
    createdBy: userId,
    batchId
  };

  let isDirty = false;

  if (!skipCheck) {
    const crossDateCheck = checkCrossDate(record.inspectionDate, new Date().toISOString().split('T')[0], 'inspectionDate');
    if (crossDateCheck) {
      await saveDirtyRecord('inspection', record.id!, crossDateCheck, batchId);
      isDirty = true;
    }

    const prev = await db.get('SELECT carModel FROM inspections WHERE vin = ? LIMIT 1', [record.vin]) as { carModel: string } | undefined;
    if (prev) {
      const nameCheck = checkNameChanged(record.carModel, prev.carModel, 'carModel', record.vin);
      if (nameCheck) {
        await saveDirtyRecord('inspection', record.id!, nameCheck, batchId);
        isDirty = true;
      }
    }
  }

  if (isDirty) {
    record.status = 'dirty';
  }

  await db.run(`
    INSERT INTO inspections
    (id, vin, carModel, plateNumber, inspector, inspectionDate, mileage, items, estimatedCost,
     sourceRow, sourceFile, status, createdBy, batchId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    record.id,
    record.vin,
    record.carModel,
    record.plateNumber,
    record.inspector,
    record.inspectionDate,
    record.mileage,
    record.items,
    record.estimatedCost,
    record.sourceRow,
    record.sourceFile,
    record.status,
    record.createdBy,
    record.batchId
  ]);

  return { record, id: record.id!, status: record.status };
}

async function importRepairQuote(
  rawData: any,
  sourceRow: number,
  sourceFile: string,
  batchId: string,
  userId: string,
  skipCheck: boolean
): Promise<{ record: RepairQuoteRecord; id: string; status: RecordStatus }> {
  const db = await getDatabase();

  const requiredFields = ['vin', 'itemName', 'quantity', 'unitPrice'];
  const missingCheck = checkMissingFields(rawData, requiredFields);
  if (missingCheck && !skipCheck) {
    throw new Error(missingCheck.description);
  }

  const quantity = parseInt(rawData.quantity) || 0;
  const unitPrice = parseFloat(rawData.unitPrice) || 0;
  const calculatedTotal = quantity * unitPrice;
  const providedTotal = parseFloat(rawData.totalPrice) || calculatedTotal;

  const record: RepairQuoteRecord = {
    id: uuidv4(),
    vin: String(rawData.vin || '').trim(),
    plateNumber: String(rawData.plateNumber || '').trim(),
    repairShop: String(rawData.repairShop || '').trim(),
    quoteDate: String(rawData.quoteDate || '').trim(),
    itemName: String(rawData.itemName || '').trim(),
    quantity,
    unitPrice,
    totalPrice: providedTotal,
    technician: String(rawData.technician || '').trim(),
    sourceRow,
    sourceFile,
    status: 'imported',
    createdBy: userId,
    batchId
  };

  let isDirty = false;

  if (!skipCheck) {
    const amountCheck = checkAmountConflict(providedTotal, calculatedTotal, 'totalPrice');
    if (amountCheck) {
      await saveDirtyRecord('repair_quote', record.id!, amountCheck, batchId);
      isDirty = true;
    }

    if (record.quoteDate) {
      const crossDateCheck = checkCrossDate(record.quoteDate, new Date().toISOString().split('T')[0], 'quoteDate');
      if (crossDateCheck) {
        await saveDirtyRecord('repair_quote', record.id!, crossDateCheck, batchId);
        isDirty = true;
      }
    }
  }

  if (isDirty) {
    record.status = 'dirty';
  }

  await db.run(`
    INSERT INTO repair_quotes
    (id, vin, plateNumber, repairShop, quoteDate, itemName, quantity, unitPrice, totalPrice,
     technician, sourceRow, sourceFile, status, createdBy, batchId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    record.id,
    record.vin,
    record.plateNumber,
    record.repairShop,
    record.quoteDate,
    record.itemName,
    record.quantity,
    record.unitPrice,
    record.totalPrice,
    record.technician,
    record.sourceRow,
    record.sourceFile,
    record.status,
    record.createdBy,
    record.batchId
  ]);

  return { record, id: record.id!, status: record.status };
}

async function importPhotoList(
  rawData: any,
  sourceRow: number,
  sourceFile: string,
  batchId: string,
  userId: string,
  skipCheck: boolean
): Promise<{ record: PhotoListRecord; id: string; status: RecordStatus }> {
  const db = await getDatabase();

  const requiredFields = ['vin', 'photoDate', 'photoCount'];
  const missingCheck = checkMissingFields(rawData, requiredFields);
  if (missingCheck && !skipCheck) {
    throw new Error(missingCheck.description);
  }

  const record: PhotoListRecord = {
    id: uuidv4(),
    vin: String(rawData.vin || '').trim(),
    plateNumber: String(rawData.plateNumber || '').trim(),
    photoDate: String(rawData.photoDate || '').trim(),
    photoType: String(rawData.photoType || '').trim(),
    photoCount: parseInt(rawData.photoCount) || 0,
    photographer: String(rawData.photographer || '').trim(),
    sourceRow,
    sourceFile,
    status: 'imported',
    createdBy: userId,
    batchId
  };

  let isDirty = false;

  if (!skipCheck) {
    if (record.photoCount < 0 || record.photoCount > 100) {
      await saveDirtyRecord('photo_list', record.id!, {
        dirtyType: 'quantity_conflict',
        fieldName: 'photoCount',
        originalValue: String(record.photoCount),
        expectedValue: '0-100',
        description: `照片数量异常: ${record.photoCount}，应在0-100之间`,
        suggestion: '请检查照片数量是否正确'
      }, batchId);
      isDirty = true;
    }

    if (record.photoDate) {
      const crossDateCheck = checkCrossDate(record.photoDate, new Date().toISOString().split('T')[0], 'photoDate');
      if (crossDateCheck) {
        await saveDirtyRecord('photo_list', record.id!, crossDateCheck, batchId);
        isDirty = true;
      }
    }
  }

  if (isDirty) {
    record.status = 'dirty';
  }

  await db.run(`
    INSERT INTO photo_lists
    (id, vin, plateNumber, photoDate, photoType, photoCount, photographer,
     sourceRow, sourceFile, status, createdBy, batchId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    record.id,
    record.vin,
    record.plateNumber,
    record.photoDate,
    record.photoType,
    record.photoCount,
    record.photographer,
    record.sourceRow,
    record.sourceFile,
    record.status,
    record.createdBy,
    record.batchId
  ]);

  return { record, id: record.id!, status: record.status };
}

async function importShiftRecord(
  rawData: any,
  sourceRow: number,
  sourceFile: string,
  batchId: string,
  userId: string,
  skipCheck: boolean
): Promise<{ record: ShiftRecord; id: string; status: RecordStatus }> {
  const db = await getDatabase();

  const requiredFields = ['vin', 'shiftDate', 'worker'];
  const missingCheck = checkMissingFields(rawData, requiredFields);
  if (missingCheck && !skipCheck) {
    throw new Error(missingCheck.description);
  }

  const record: ShiftRecord = {
    id: uuidv4(),
    vin: String(rawData.vin || '').trim(),
    plateNumber: String(rawData.plateNumber || '').trim(),
    shiftDate: String(rawData.shiftDate || '').trim(),
    shiftType: String(rawData.shiftType || '').trim(),
    worker: String(rawData.worker || '').trim(),
    workHours: parseFloat(rawData.workHours) || 0,
    sourceRow,
    sourceFile,
    status: 'imported',
    createdBy: userId,
    batchId
  };

  let isDirty = false;

  if (!skipCheck) {
    if (record.workHours < 0 || record.workHours > 24) {
      await saveDirtyRecord('shift_record', record.id!, {
        dirtyType: 'quantity_conflict',
        fieldName: 'workHours',
        originalValue: String(record.workHours),
        expectedValue: '0-24',
        description: `工作时长异常: ${record.workHours}小时，应在0-24之间`,
        suggestion: '请检查工作时长是否正确'
      }, batchId);
      isDirty = true;
    }
  }

  if (isDirty) {
    record.status = 'dirty';
  }

  await db.run(`
    INSERT INTO shift_records
    (id, vin, plateNumber, shiftDate, shiftType, worker, workHours,
     sourceRow, sourceFile, status, createdBy, batchId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    record.id,
    record.vin,
    record.plateNumber,
    record.shiftDate,
    record.shiftType,
    record.worker,
    record.workHours,
    record.sourceRow,
    record.sourceFile,
    record.status,
    record.createdBy,
    record.batchId
  ]);

  return { record, id: record.id!, status: record.status };
}

async function importManualPrice(
  rawData: any,
  sourceRow: number,
  sourceFile: string,
  batchId: string,
  userId: string,
  skipCheck: boolean
): Promise<{ record: ManualPriceRecord; id: string; status: RecordStatus }> {
  const db = await getDatabase();

  const requiredFields = ['vin', 'itemName', 'originalPrice', 'adjustedPrice'];
  const missingCheck = checkMissingFields(rawData, requiredFields);
  if (missingCheck && !skipCheck) {
    throw new Error(missingCheck.description);
  }

  const record: ManualPriceRecord = {
    id: uuidv4(),
    vin: String(rawData.vin || '').trim(),
    plateNumber: String(rawData.plateNumber || '').trim(),
    itemName: String(rawData.itemName || '').trim(),
    originalPrice: parseFloat(rawData.originalPrice) || 0,
    adjustedPrice: parseFloat(rawData.adjustedPrice) || 0,
    adjustReason: String(rawData.adjustReason || '').trim(),
    adjustDate: String(rawData.adjustDate || '').trim(),
    adjustedBy: String(rawData.adjustedBy || '').trim(),
    sourceRow,
    sourceFile,
    status: 'imported',
    createdBy: userId,
    batchId
  };

  let isDirty = false;

  if (!skipCheck) {
    const diff = record.adjustedPrice - record.originalPrice;
    const ratio = record.originalPrice > 0 ? Math.abs(diff) / record.originalPrice : 0;
    if (ratio > 0.5) {
      await saveDirtyRecord('manual_price', record.id!, {
        dirtyType: 'amount_conflict',
        fieldName: 'adjustedPrice',
        originalValue: String(record.originalPrice),
        expectedValue: `调价幅度不超过50%`,
        description: `调价幅度过大: 原价${record.originalPrice} -> 调整后${record.adjustedPrice}，调整幅度${(ratio * 100).toFixed(2)}%`,
        suggestion: '请确认调价是否合理，或填写详细调价原因'
      }, batchId);
      isDirty = true;
    }
  }

  if (isDirty) {
    record.status = 'dirty';
  }

  await db.run(`
    INSERT INTO manual_prices
    (id, vin, plateNumber, itemName, originalPrice, adjustedPrice, adjustReason, adjustDate, adjustedBy,
     sourceRow, sourceFile, status, createdBy, batchId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    record.id,
    record.vin,
    record.plateNumber,
    record.itemName,
    record.originalPrice,
    record.adjustedPrice,
    record.adjustReason,
    record.adjustDate,
    record.adjustedBy,
    record.sourceRow,
    record.sourceFile,
    record.status,
    record.createdBy,
    record.batchId
  ]);

  return { record, id: record.id!, status: record.status };
}

export async function getImportBatches(sourceType?: SourceType): Promise<any[]> {
  const db = await getDatabase();
  let sql = 'SELECT * FROM import_batches';
  const params: any[] = [];

  if (sourceType) {
    sql += ' WHERE sourceType = ?';
    params.push(sourceType);
  }

  sql += ' ORDER BY importedAt DESC';

  return db.all(sql, params);
}
