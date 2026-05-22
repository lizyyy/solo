import { runQuery, runInsert, runUpdate } from '../database/connection';
import { TABLES } from '../database/schema';
import {
  ImportResult,
  OrderItemRaw,
  WasteRecordRaw,
  HeadquarterPriceRaw,
  SupplementRecordRaw,
  SourceType
} from '../types';
import {
  generateOrderFactId,
  generateWasteFactId,
  generatePriceFactId,
  generateSupplementFactId,
  generateSourceId,
  generateFileHash
} from '../utils/factId';

interface ImportSourceRecord {
  source_id: string;
  file_name: string;
  file_hash: string;
  source_type: string;
  imported_by: string;
}

export const createImportSource = async (
  fileName: string,
  fileContent: string,
  sourceType: SourceType,
  importedBy: string
): Promise<string> => {
  const fileHash = generateFileHash(fileContent);
  const sourceId = generateSourceId(fileName, fileHash);

  const existing = await runQuery<ImportSourceRecord>(
    `SELECT source_id FROM ${TABLES.IMPORT_SOURCES} WHERE source_id = ?`,
    [sourceId]
  );

  if (existing.length > 0) {
    console.log(`文件已存在，使用现有 source_id: ${sourceId}`);
    return sourceId;
  }

  await runInsert(
    `INSERT INTO ${TABLES.IMPORT_SOURCES} (source_id, file_name, file_hash, source_type, imported_by)
     VALUES (?, ?, ?, ?, ?)`,
    [sourceId, fileName, fileHash, sourceType, importedBy]
  );

  return sourceId;
};

export const importOrderItems = async (
  sourceId: string,
  items: OrderItemRaw[],
  fileName: string
): Promise<ImportResult> => {
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const lineNumber = i + 1;
    const factId = generateOrderFactId(item.orderNo, item.materialCode);
    const rawData = JSON.stringify(item);

    const existing = await runQuery(
      `SELECT fact_id FROM ${TABLES.ORDER_ITEMS} WHERE fact_id = ?`,
      [factId]
    );

    if (existing.length > 0) {
      const changes = await runUpdate(
        `UPDATE ${TABLES.ORDER_ITEMS} SET
          source_id = ?,
          source_line_number = ?,
          raw_data = ?,
          quantity = ?,
          unit = ?,
          franchisee_name = ?,
          order_date = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE fact_id = ?`,
        [
          sourceId,
          lineNumber,
          rawData,
          item.quantity,
          item.unit,
          item.franchiseeName,
          item.orderDate,
          factId
        ]
      );
      if (changes > 0) {
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      await runInsert(
        `INSERT INTO ${TABLES.ORDER_ITEMS} (
          fact_id, source_id, source_line_number, raw_data,
          order_no, material_code, material_name, quantity, unit,
          franchisee_id, franchisee_name, order_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          factId, sourceId, lineNumber, rawData,
          item.orderNo, item.materialCode, item.materialName, item.quantity, item.unit,
          item.franchiseeId, item.franchiseeName, item.orderDate
        ]
      );
      insertedCount++;
    }
  }

  return {
    sourceId,
    totalRecords: items.length,
    insertedCount,
    updatedCount,
    skippedCount
  };
};

export const importWasteRecords = async (
  sourceId: string,
  records: WasteRecordRaw[],
  fileName: string
): Promise<ImportResult> => {
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const lineNumber = i + 1;
    const factId = generateWasteFactId(record.wasteNo, record.materialCode);
    const rawData = JSON.stringify(record);

    const existing = await runQuery(
      `SELECT fact_id FROM ${TABLES.WASTE_RECORDS} WHERE fact_id = ?`,
      [factId]
    );

    if (existing.length > 0) {
      const changes = await runUpdate(
        `UPDATE ${TABLES.WASTE_RECORDS} SET
          source_id = ?,
          source_line_number = ?,
          raw_data = ?,
          quantity = ?,
          unit = ?,
          waste_reason = ?,
          franchisee_name = ?,
          waste_date = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE fact_id = ?`,
        [
          sourceId,
          lineNumber,
          rawData,
          record.quantity,
          record.unit,
          record.wasteReason,
          record.franchiseeName,
          record.wasteDate,
          factId
        ]
      );
      if (changes > 0) {
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      await runInsert(
        `INSERT INTO ${TABLES.WASTE_RECORDS} (
          fact_id, source_id, source_line_number, raw_data,
          waste_no, material_code, material_name, quantity, unit, waste_reason,
          franchisee_id, franchisee_name, waste_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          factId, sourceId, lineNumber, rawData,
          record.wasteNo, record.materialCode, record.materialName, record.quantity, record.unit, record.wasteReason,
          record.franchiseeId, record.franchiseeName, record.wasteDate
        ]
      );
      insertedCount++;
    }
  }

  return {
    sourceId,
    totalRecords: records.length,
    insertedCount,
    updatedCount,
    skippedCount
  };
};

export const importHeadquarterPrices = async (
  sourceId: string,
  prices: HeadquarterPriceRaw[],
  fileName: string
): Promise<ImportResult> => {
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    const lineNumber = i + 1;
    const factId = generatePriceFactId(price.materialCode, price.effectiveDate);
    const rawData = JSON.stringify(price);

    const existing = await runQuery(
      `SELECT fact_id FROM ${TABLES.HEADQUARTER_PRICES} WHERE fact_id = ?`,
      [factId]
    );

    if (existing.length > 0) {
      const changes = await runUpdate(
        `UPDATE ${TABLES.HEADQUARTER_PRICES} SET
          source_id = ?,
          source_line_number = ?,
          raw_data = ?,
          material_name = ?,
          price = ?,
          unit = ?,
          expire_date = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE fact_id = ?`,
        [
          sourceId,
          lineNumber,
          rawData,
          price.materialName,
          price.price,
          price.unit,
          price.expireDate || null,
          factId
        ]
      );
      if (changes > 0) {
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      await runInsert(
        `INSERT INTO ${TABLES.HEADQUARTER_PRICES} (
          fact_id, source_id, source_line_number, raw_data,
          material_code, material_name, price, unit, effective_date, expire_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          factId, sourceId, lineNumber, rawData,
          price.materialCode, price.materialName, price.price, price.unit, price.effectiveDate,
          price.expireDate || null
        ]
      );
      insertedCount++;
    }
  }

  return {
    sourceId,
    totalRecords: prices.length,
    insertedCount,
    updatedCount,
    skippedCount
  };
};

export const importSupplementRecords = async (
  sourceId: string,
  records: SupplementRecordRaw[],
  fileName: string
): Promise<ImportResult> => {
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const lineNumber = i + 1;
    const factId = generateSupplementFactId(record.supplementNo, record.materialCode);
    const rawData = JSON.stringify(record);

    const existing = await runQuery(
      `SELECT fact_id FROM ${TABLES.SUPPLEMENT_RECORDS} WHERE fact_id = ?`,
      [factId]
    );

    if (existing.length > 0) {
      const changes = await runUpdate(
        `UPDATE ${TABLES.SUPPLEMENT_RECORDS} SET
          source_id = ?,
          source_line_number = ?,
          raw_data = ?,
          quantity = ?,
          unit = ?,
          supplement_reason = ?,
          franchisee_name = ?,
          supplement_date = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE fact_id = ?`,
        [
          sourceId,
          lineNumber,
          rawData,
          record.quantity,
          record.unit,
          record.supplementReason,
          record.franchiseeName,
          record.supplementDate,
          factId
        ]
      );
      if (changes > 0) {
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      await runInsert(
        `INSERT INTO ${TABLES.SUPPLEMENT_RECORDS} (
          fact_id, source_id, source_line_number, raw_data,
          supplement_no, material_code, material_name, quantity, unit, supplement_reason,
          franchisee_id, franchisee_name, supplement_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          factId, sourceId, lineNumber, rawData,
          record.supplementNo, record.materialCode, record.materialName, record.quantity, record.unit, record.supplementReason,
          record.franchiseeId, record.franchiseeName, record.supplementDate
        ]
      );
      insertedCount++;
    }
  }

  return {
    sourceId,
    totalRecords: records.length,
    insertedCount,
    updatedCount,
    skippedCount
  };
};
