import { getDatabase } from '../database';
import { SourceType } from '../types';
import fs from 'fs';
import path from 'path';

export interface ExportOptions {
  sourceType?: SourceType;
  status?: string;
  batchId?: string;
  includeDirty?: boolean;
  outputPath: string;
}

export async function exportData(options: ExportOptions): Promise<void> {
  const { sourceType, status, batchId, includeDirty = false, outputPath } = options;

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const data: any = {
    exportTime: new Date().toISOString(),
    filters: { sourceType, status, batchId, includeDirty }
  };

  if (!sourceType || sourceType === 'inspection') {
    data.inspections = await queryTable('inspections', status, batchId);
  }
  if (!sourceType || sourceType === 'repair_quote') {
    data.repairQuotes = await queryTable('repair_quotes', status, batchId);
  }
  if (!sourceType || sourceType === 'photo_list') {
    data.photoLists = await queryTable('photo_lists', status, batchId);
  }
  if (!sourceType || sourceType === 'shift_record') {
    data.shiftRecords = await queryTable('shift_records', status, batchId);
  }
  if (!sourceType || sourceType === 'manual_price') {
    data.manualPrices = await queryTable('manual_prices', status, batchId);
  }

  if (includeDirty) {
    data.dirtyRecords = await queryDirtyRecords(sourceType);
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function queryTable(table: string, status?: string, batchId?: string): Promise<any[]> {
  const db = await getDatabase();
  let sql = `SELECT * FROM ${table}`;
  const params: any[] = [];
  const conditions: string[] = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (batchId) {
    conditions.push('batchId = ?');
    params.push(batchId);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY sourceRow';

  return db.all(sql, params);
}

async function queryDirtyRecords(sourceType?: SourceType): Promise<any[]> {
  const db = await getDatabase();
  let sql = 'SELECT * FROM dirty_records';
  const params: any[] = [];

  if (sourceType) {
    sql += ' WHERE sourceType = ?';
    params.push(sourceType);
  }

  sql += ' ORDER BY createdAt DESC';

  return db.all(sql, params);
}

export async function exportFailedRecords(batchId: string, outputPath: string): Promise<void> {
  const db = await getDatabase();
  const batch = await db.get('SELECT * FROM import_batches WHERE id = ?', [batchId]);

  if (!batch) {
    throw new Error(`批次不存在: ${batchId}`);
  }

  const dirtyRecords = await db.all(`
    SELECT dr.*,
      CASE dr.sourceType
        WHEN 'inspection' THEN i.sourceRow
        WHEN 'repair_quote' THEN rq.sourceRow
        WHEN 'photo_list' THEN pl.sourceRow
        WHEN 'shift_record' THEN sr.sourceRow
        WHEN 'manual_price' THEN mp.sourceRow
      END as sourceRow,
      CASE dr.sourceType
        WHEN 'inspection' THEN i.sourceFile
        WHEN 'repair_quote' THEN rq.sourceFile
        WHEN 'photo_list' THEN pl.sourceFile
        WHEN 'shift_record' THEN sr.sourceFile
        WHEN 'manual_price' THEN mp.sourceFile
      END as sourceFile
    FROM dirty_records dr
    LEFT JOIN inspections i ON dr.sourceType = 'inspection' AND dr.sourceId = i.id
    LEFT JOIN repair_quotes rq ON dr.sourceType = 'repair_quote' AND dr.sourceId = rq.id
    LEFT JOIN photo_lists pl ON dr.sourceType = 'photo_list' AND dr.sourceId = pl.id
    LEFT JOIN shift_records sr ON dr.sourceType = 'shift_record' AND dr.sourceId = sr.id
    LEFT JOIN manual_prices mp ON dr.sourceType = 'manual_price' AND dr.sourceId = mp.id
    WHERE dr.batchId = ?
  `, [batchId]);

  const output = {
    batchId,
    batchInfo: batch,
    exportTime: new Date().toISOString(),
    totalDirty: dirtyRecords.length,
    records: dirtyRecords.map((r: any) => ({
      sourceType: r.sourceType,
      sourceRow: r.sourceRow,
      sourceFile: r.sourceFile,
      dirtyType: r.dirtyType,
      fieldName: r.fieldName,
      originalValue: r.originalValue,
      expectedValue: r.expectedValue,
      description: r.description,
      suggestion: r.suggestion,
      isFixed: r.isFixed,
      fixedValue: r.fixedValue
    }))
  };

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
}
