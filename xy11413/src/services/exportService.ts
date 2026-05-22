import { runQuery, runInsert } from '../database/connection';
import { TABLES } from '../database/schema';
import { Parser } from 'json2csv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const EXPORT_DIR = path.join(process.cwd(), 'exports');

const ensureExportDir = () => {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
};

export const exportReconciliationResults = async (
  taskId: string,
  exportedBy: string
): Promise<{ exportId: string; filePath: string; recordCount: number }> => {
  ensureExportDir();

  const results = await runQuery(
    `SELECT r.result_id, r.task_id, r.franchisee_id, r.material_code, 
            r.expected_quantity, r.actual_quantity, r.difference,
            r.unit_price, r.difference_amount, r.status, r.created_at,
            o.material_name, o.unit
     FROM ${TABLES.RECONCILIATION_RESULTS} r
     LEFT JOIN ${TABLES.ORDER_ITEMS} o ON r.franchisee_id = o.franchisee_id AND r.material_code = o.material_code
     WHERE r.task_id = ?
     GROUP BY r.result_id`,
    [taskId]
  );

  if (results.length === 0) {
    throw new Error('没有可导出的对账结果');
  }

  const fields = [
    'result_id', 'task_id', 'franchisee_id', 'material_code', 'material_name',
    'expected_quantity', 'actual_quantity', 'difference', 'unit',
    'unit_price', 'difference_amount', 'status', 'created_at'
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(results);

  const exportId = `export_${uuidv4().slice(0, 24)}`;
  const fileName = `reconciliation_${taskId}_${Date.now()}.csv`;
  const filePath = path.join(EXPORT_DIR, fileName);

  fs.writeFileSync(filePath, csv, 'utf-8');

  const fileHash = crypto.createHash('md5').update(csv).digest('hex');

  await runInsert(
    `INSERT INTO ${TABLES.EXPORT_RECORDS} (
      export_id, task_id, export_type, file_path, exported_by, record_count, export_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [exportId, taskId, 'reconciliation', filePath, exportedBy, results.length, fileHash]
  );

  return {
    exportId,
    filePath,
    recordCount: results.length
  };
};

export const exportRawData = async (
  sourceType: 'order' | 'waste' | 'price' | 'supplement',
  exportedBy: string,
  franchiseeId?: string
): Promise<{ exportId: string; filePath: string; recordCount: number }> => {
  ensureExportDir();

  const tableMap: Record<string, string> = {
    order: TABLES.ORDER_ITEMS,
    waste: TABLES.WASTE_RECORDS,
    price: TABLES.HEADQUARTER_PRICES,
    supplement: TABLES.SUPPLEMENT_RECORDS
  };

  const tableName = tableMap[sourceType];
  let whereClause = franchiseeId ? 'WHERE franchisee_id = ?' : '';
  const params = franchiseeId ? [franchiseeId] : [];

  const records = await runQuery(
    `SELECT * FROM ${tableName} ${whereClause} ORDER BY created_at DESC`,
    params
  );

  if (records.length === 0) {
    throw new Error('没有可导出的数据');
  }

  const fields = Object.keys(records[0] as object);
  const parser = new Parser({ fields });
  const csv = parser.parse(records);

  const exportId = `export_${uuidv4().slice(0, 24)}`;
  const fileName = `${sourceType}_raw_${Date.now()}.csv`;
  const filePath = path.join(EXPORT_DIR, fileName);

  fs.writeFileSync(filePath, csv, 'utf-8');

  const fileHash = crypto.createHash('md5').update(csv).digest('hex');

  await runInsert(
    `INSERT INTO ${TABLES.EXPORT_RECORDS} (
      export_id, export_type, file_path, exported_by, record_count, export_hash
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [exportId, `${sourceType}_raw`, filePath, exportedBy, records.length, fileHash]
  );

  return {
    exportId,
    filePath,
    recordCount: records.length
  };
};

export const getExportHistory = async () => {
  return await runQuery(
    `SELECT * FROM ${TABLES.EXPORT_RECORDS} ORDER BY created_at DESC LIMIT 50`
  );
};

export const verifyExportIntegrity = async (exportId: string): Promise<boolean> => {
  const records = await runQuery<{ file_path: string; export_hash: string }>(
    `SELECT file_path, export_hash FROM ${TABLES.EXPORT_RECORDS} WHERE export_id = ?`,
    [exportId]
  );

  if (records.length === 0) {
    return false;
  }

  const record = records[0];
  if (!fs.existsSync(record.file_path)) {
    return false;
  }

  const content = fs.readFileSync(record.file_path, 'utf-8');
  const currentHash = crypto.createHash('md5').update(content).digest('hex');

  return currentHash === record.export_hash;
};
