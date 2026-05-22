import { getDatabase } from '../database';
import { DirtyRecord, DirtyType, SourceType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

interface CheckResult {
  dirtyType: DirtyType;
  fieldName?: string;
  originalValue?: string;
  expectedValue?: string;
  description: string;
  suggestion?: string;
}

export function checkMissingFields(data: any, requiredFields: string[]): CheckResult | null {
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

export function checkCrossDate(dateStr: string, referenceDate: string, dateField: string): CheckResult | null {
  if (!dateStr || !referenceDate) return null;
  
  const date = moment(dateStr, 'YYYY-MM-DD', true);
  const refDate = moment(referenceDate, 'YYYY-MM-DD', true);
  
  if (!date.isValid() || !refDate.isValid()) return null;
  
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

export function checkNameChanged(
  currentName: string,
  previousName: string,
  nameField: string,
  vin: string
): CheckResult | null {
  if (!currentName || !previousName) return null;
  
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

export function checkAmountConflict(
  currentAmount: number,
  expectedAmount: number,
  amountField: string,
  tolerance: number = 0.05
): CheckResult | null {
  if (currentAmount === undefined || expectedAmount === undefined) return null;
  
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

export function checkQuantityConflict(
  currentQty: number,
  expectedQty: number,
  qtyField: string
): CheckResult | null {
  if (currentQty === undefined || expectedQty === undefined) return null;
  
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

export async function checkDuplicate(
  sourceType: SourceType,
  uniqueKey: string,
  keyValue: string
): Promise<CheckResult | null> {
  const db = await getDatabase();
  const tableMap: Record<SourceType, string> = {
    inspection: 'inspections',
    repair_quote: 'repair_quotes',
    photo_list: 'photo_lists',
    shift_record: 'shift_records',
    manual_price: 'manual_prices'
  };
  
  const table = tableMap[sourceType];
  const result = await db.get(`SELECT COUNT(*) as count FROM ${table} WHERE ${uniqueKey} = ?`, [keyValue]) as { count: number };
  
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

export async function saveDirtyRecord(
  sourceType: SourceType,
  sourceId: string,
  checkResult: CheckResult,
  batchId: string
): Promise<string> {
  const db = await getDatabase();
  const id = uuidv4();
  
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

export async function getDirtyRecords(sourceType?: SourceType, isFixed?: boolean): Promise<DirtyRecord[]> {
  const db = await getDatabase();
  let sql = 'SELECT * FROM dirty_records';
  const params: any[] = [];
  
  const conditions: string[] = [];
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
  
  return db.all(sql, params) as Promise<DirtyRecord[]>;
}

export async function fixDirtyRecord(
  dirtyId: string,
  fixedValue: string,
  fixedBy: string
): Promise<boolean> {
  const db = await getDatabase();
  
  const dirty = await db.get('SELECT * FROM dirty_records WHERE id = ?', [dirtyId]) as DirtyRecord;
  
  if (!dirty) return false;
  
  await db.run(`
    UPDATE dirty_records
    SET isFixed = 1, fixedBy = ?, fixedAt = CURRENT_TIMESTAMP, fixedValue = ?
    WHERE id = ?
  `, [fixedBy, fixedValue, dirtyId]);
  
  const tableMap: Record<SourceType, string> = {
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

export async function getDirtyStats(): Promise<{
  total: number;
  byType: Record<DirtyType, number>;
  bySource: Record<SourceType, number>;
  fixed: number;
  pending: number;
}> {
  const db = await getDatabase();
  
  const totalResult = await db.get('SELECT COUNT(*) as count FROM dirty_records') as { count: number };
  const fixedResult = await db.get('SELECT COUNT(*) as count FROM dirty_records WHERE isFixed = 1') as { count: number };
  
  const byTypeResult = await db.all(`
    SELECT dirtyType, COUNT(*) as count 
    FROM dirty_records 
    GROUP BY dirtyType
  `) as { dirtyType: DirtyType; count: number }[];
  
  const bySourceResult = await db.all(`
    SELECT sourceType, COUNT(*) as count 
    FROM dirty_records 
    GROUP BY sourceType
  `) as { sourceType: SourceType; count: number }[];
  
  const byType: Record<DirtyType, number> = {
    missing_field: 0,
    cross_date: 0,
    name_changed: 0,
    amount_conflict: 0,
    quantity_conflict: 0,
    duplicate: 0
  };
  
  byTypeResult.forEach(r => byType[r.dirtyType] = r.count);
  
  const bySource: Record<SourceType, number> = {
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
