import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll } from '../database';
import { SampleRecord, InspectionItem, ImportRecord } from '../types';
import * as crypto from 'crypto';

export interface CsvSampleRow {
  sample_no: string;
  batch_id: string;
  sample_type: string;
  cooperative_id: string;
  cooperative_name: string;
  collection_date: string;
  quantity: string;
  unit: string;
  received_at: string;
  [key: string]: string;
}

export interface JsonInspectionData {
  batch_id: string;
  samples: Array<{
    sample_no: string;
    items: Array<{
      item_code: string;
      item_name: string;
      standard_value: string;
      actual_value: string;
      unit: string;
      result: 'pass' | 'fail' | 'pending';
      is_retest?: boolean;
      retest_of?: string;
      inspection_date: string;
      inspector: string;
    }>;
  }>;
}

export function computeFileHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

export async function importSampleCsv(
  content: string,
  filename: string,
  importedBy: string
): Promise<{ importRecord: ImportRecord; samples: SampleRecord[]; errors: string[] }> {
  const fileHash = computeFileHash(content);
  const errors: string[] = [];
  const samples: SampleRecord[] = [];
  const now = new Date().toISOString();

  let rows: CsvSampleRow[];
  try {
    rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvSampleRow[];
  } catch (e) {
    errors.push(`CSV解析失败: ${(e as Error).message}`);
    const importRecord: ImportRecord = {
      id: uuidv4(),
      type: 'csv',
      filename,
      file_hash: fileHash,
      record_count: 0,
      success_count: 0,
      error_count: 1,
      errors: JSON.stringify(errors),
      imported_by: importedBy,
      created_at: now,
    };
    await runQuery(
      `INSERT INTO import_records (id, type, filename, file_hash, record_count, success_count, error_count, errors, imported_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [importRecord.id, importRecord.type, importRecord.filename, importRecord.file_hash,
       importRecord.record_count, importRecord.success_count, importRecord.error_count,
       importRecord.errors, importRecord.imported_by, importRecord.created_at]
    );
    return { importRecord, samples, errors };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    if (!row.sample_no || !row.batch_id) {
      errors.push(`第${lineNum}行: 缺少必填字段 sample_no 或 batch_id`);
      continue;
    }

    try {
      const existing = await getOne<SampleRecord>(
        `SELECT * FROM sample_records WHERE batch_id = ? AND sample_no = ?`,
        [row.batch_id, row.sample_no]
      );

      const sample: SampleRecord = {
        id: uuidv4(),
        batch_id: row.batch_id.trim(),
        sample_no: row.sample_no.trim(),
        sample_type: row.sample_type?.trim() || '',
        cooperative_id: row.cooperative_id?.trim() || '',
        cooperative_name: row.cooperative_name?.trim() || '',
        collection_date: row.collection_date?.trim() || '',
        quantity: parseFloat(row.quantity) || 0,
        unit: row.unit?.trim() || '',
        received_at: row.received_at?.trim() || now,
        status: 'pending',
        raw_data: JSON.stringify(row),
        created_at: now,
        updated_at: now,
      };

      if (existing) {
        sample.id = existing.id;
        sample.status = existing.status;
        sample.created_at = existing.created_at;
        await runQuery(
          `UPDATE sample_records SET 
           sample_type = ?, cooperative_id = ?, cooperative_name = ?,
           collection_date = ?, quantity = ?, unit = ?, received_at = ?,
           raw_data = ?, updated_at = ?
           WHERE id = ?`,
          [sample.sample_type, sample.cooperative_id, sample.cooperative_name,
           sample.collection_date, sample.quantity, sample.unit, sample.received_at,
           sample.raw_data, sample.updated_at, sample.id]
        );
      } else {
        await runQuery(
          `INSERT INTO sample_records 
           (id, batch_id, sample_no, sample_type, cooperative_id, cooperative_name,
            collection_date, quantity, unit, received_at, status, raw_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sample.id, sample.batch_id, sample.sample_no, sample.sample_type,
           sample.cooperative_id, sample.cooperative_name, sample.collection_date,
           sample.quantity, sample.unit, sample.received_at, sample.status,
           sample.raw_data, sample.created_at, sample.updated_at]
        );
      }

      samples.push(sample);
    } catch (e) {
      errors.push(`第${lineNum}行: 保存失败 - ${(e as Error).message}`);
    }
  }

  const importRecord: ImportRecord = {
    id: uuidv4(),
    type: 'csv',
    filename,
    file_hash: fileHash,
    record_count: rows.length,
    success_count: samples.length,
    error_count: errors.length,
    errors: JSON.stringify(errors),
    imported_by: importedBy,
    created_at: now,
  };

  await runQuery(
    `INSERT INTO import_records (id, type, filename, file_hash, record_count, success_count, error_count, errors, imported_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [importRecord.id, importRecord.type, importRecord.filename, importRecord.file_hash,
     importRecord.record_count, importRecord.success_count, importRecord.error_count,
     importRecord.errors, importRecord.imported_by, importRecord.created_at]
  );

  return { importRecord, samples, errors };
}

export async function importInspectionJson(
  content: string,
  filename: string,
  importedBy: string
): Promise<{ importRecord: ImportRecord; items: InspectionItem[]; errors: string[] }> {
  const fileHash = computeFileHash(content);
  const errors: string[] = [];
  const items: InspectionItem[] = [];
  const now = new Date().toISOString();

  let data: JsonInspectionData;
  try {
    data = JSON.parse(content);
  } catch (e) {
    errors.push(`JSON解析失败: ${(e as Error).message}`);
    const importRecord: ImportRecord = {
      id: uuidv4(),
      type: 'json',
      filename,
      file_hash: fileHash,
      record_count: 0,
      success_count: 0,
      error_count: 1,
      errors: JSON.stringify(errors),
      imported_by: importedBy,
      created_at: now,
    };
    await runQuery(
      `INSERT INTO import_records (id, type, filename, file_hash, record_count, success_count, error_count, errors, imported_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [importRecord.id, importRecord.type, importRecord.filename, importRecord.file_hash,
       importRecord.record_count, importRecord.success_count, importRecord.error_count,
       importRecord.errors, importRecord.imported_by, importRecord.created_at]
    );
    return { importRecord, items, errors };
  }

  if (!data.batch_id || !Array.isArray(data.samples)) {
    errors.push('JSON格式错误: 缺少 batch_id 或 samples 数组');
  }

  const batchId = data.batch_id || '';
  let recordCount = 0;

  for (const sample of data.samples || []) {
    if (!sample.sample_no || !Array.isArray(sample.items)) {
      errors.push(`样品数据错误: 缺少 sample_no 或 items 数组`);
      continue;
    }

    let previousItemId: string | null = null;

    for (const item of sample.items) {
      recordCount++;
      try {
        let retestOf = item.retest_of;
        if (retestOf === '@previous' && previousItemId) {
          retestOf = previousItemId;
        }

        const inspectionItem: InspectionItem = {
          id: uuidv4(),
          sample_no: sample.sample_no,
          batch_id: batchId,
          item_code: item.item_code,
          item_name: item.item_name,
          standard_value: item.standard_value || '',
          actual_value: item.actual_value || '',
          unit: item.unit || '',
          result: item.result || 'pending',
          is_retest: item.is_retest || false,
          retest_of: retestOf,
          inspection_date: item.inspection_date || now,
          inspector: item.inspector || '',
          raw_data: JSON.stringify(item),
          created_at: now,
        };

        await runQuery(
          `INSERT INTO inspection_items 
           (id, sample_no, batch_id, item_code, item_name, standard_value, actual_value,
            unit, result, is_retest, retest_of, inspection_date, inspector, raw_data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [inspectionItem.id, inspectionItem.sample_no, inspectionItem.batch_id,
           inspectionItem.item_code, inspectionItem.item_name, inspectionItem.standard_value,
           inspectionItem.actual_value, inspectionItem.unit, inspectionItem.result,
           inspectionItem.is_retest ? 1 : 0, inspectionItem.retest_of,
           inspectionItem.inspection_date, inspectionItem.inspector,
           inspectionItem.raw_data, inspectionItem.created_at]
        );

        items.push(inspectionItem);
        previousItemId = inspectionItem.id;
      } catch (e) {
        errors.push(`样品 ${sample.sample_no} 项目 ${item.item_code}: 保存失败 - ${(e as Error).message}`);
      }
    }
  }

  const importRecord: ImportRecord = {
    id: uuidv4(),
    type: 'json',
    filename,
    file_hash: fileHash,
    record_count: recordCount,
    success_count: items.length,
    error_count: errors.length,
    errors: JSON.stringify(errors),
    imported_by: importedBy,
    created_at: now,
  };

  await runQuery(
    `INSERT INTO import_records (id, type, filename, file_hash, record_count, success_count, error_count, errors, imported_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [importRecord.id, importRecord.type, importRecord.filename, importRecord.file_hash,
     importRecord.record_count, importRecord.success_count, importRecord.error_count,
     importRecord.errors, importRecord.imported_by, importRecord.created_at]
  );

  return { importRecord, items, errors };
}

export async function getImportRecords(): Promise<ImportRecord[]> {
  return getAll<ImportRecord>(`SELECT * FROM import_records ORDER BY created_at DESC`);
}

export async function getImportRecord(id: string): Promise<ImportRecord | undefined> {
  return getOne<ImportRecord>(`SELECT * FROM import_records WHERE id = ?`, [id]);
}
