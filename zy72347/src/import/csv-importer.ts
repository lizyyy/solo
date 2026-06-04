import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { DataRecord, ProcessingResult, RawValue } from '../types';
import { createNewRecord, saveRecord } from '../store/data-store';
import { parseValue, detectMixedFormat } from '../core/format-detector';
import { evaluateRules } from '../core/boundary-rules';
import { logAction } from '../store/audit-log';
import { generateId } from '../utils/id';

export interface ImportOptions {
  filePath: string;
  importedBy: string;
  valueColumns: string[];
  screenshotRef?: string;
  hasHeader?: boolean;
  delimiter?: string;
}

export interface ImportSummary {
  totalRows: number;
  importedCount: number;
  mixedFormatCount: number;
  pendingReviewCount: number;
  autoNormalizedCount: number;
  errors: string[];
  importedRecordIds: string[];
}

export function importCsv(options: ImportOptions): ProcessingResult<ImportSummary> {
  const { filePath, importedBy, valueColumns, screenshotRef, hasHeader = true, delimiter = ',' } = options;

  const errors: string[] = [];
  const importedRecordIds: string[] = [];
  let mixedFormatCount = 0;
  let pendingReviewCount = 0;
  let autoNormalizedCount = 0;

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      errors: [`文件不存在: ${filePath}`],
      warnings: [],
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFileName = path.basename(filePath);

  let records: string[][];
  try {
    records = parse(content, {
      delimiter,
      skip_empty_lines: true,
    });
  } catch (e) {
      return {
        success: false,
        errors: [`CSV 解析失败: ${(e as Error).message}`],
        warnings: [],
      };
    }

  if (records.length === 0) {
    return {
      success: false,
      errors: ['CSV 文件为空'],
      warnings: [],
    };
  }

  let headers: string[] = [];
  let dataStartRow = 0;

  if (hasHeader) {
    headers = records[0].map((h) => h.trim());
    dataStartRow = 1;
  } else {
    headers = valueColumns.length > 0
      ? valueColumns
      : records[0].map((_, i) => `column_${i}`);
  }

  const valueColumnIndices: number[] = [];
  valueColumns.forEach((col) => {
    const idx = headers.indexOf(col);
    if (idx >= 0) {
      valueColumnIndices.push(idx);
    } else {
      errors.push(`未找到列: ${col}`);
    }
  });

  if (valueColumnIndices.length === 0) {
    return {
      success: false,
      errors: [...errors, '未找到任何数值列'],
      warnings: [],
    };
  }

  logAction(importedBy, 'IMPORT_START', {
    sourceFile: sourceFileName,
    valueColumns,
    totalRows: records.length - dataStartRow,
    screenshotRef,
  });

  for (let i = dataStartRow; i < records.length; i++) {
    const row = records[i];
    const originalRowNumber = i + 1;

    if (row.length < Math.max(...valueColumnIndices) + 1) {
      errors.push(`第 ${originalRowNumber} 行: 列数不足`);
      continue;
    }

    const dataRecord = createNewRecord(originalRowNumber, sourceFileName, importedBy);

    if (screenshotRef) {
      dataRecord.annotations.push({
        id: generateId('ann'),
        timestamp: Date.now(),
        author: importedBy,
        content: `旧公式截图导入: ${screenshotRef}`,
        screenshotRef,
      });
    }

    const rawValues: RawValue[] = [];

    valueColumnIndices.forEach((colIdx) => {
      const header = headers[colIdx];
      const cellValue = row[colIdx];
      const parsed = parseValue(cellValue);
      dataRecord.rawValues.set(header, parsed);
      rawValues.push(parsed);
    });

    dataRecord.hasMixedFormat = detectMixedFormat(rawValues);

    const formats = rawValues.map((v) => v.format).filter((f) => f !== 'unknown');
    if (formats.length > 0) {
      const uniqueFormats = new Set(formats);
      if (uniqueFormats.size === 1) {
        dataRecord.formatDetected = Array.from(uniqueFormats)[0];
      } else if (dataRecord.hasMixedFormat) {
        dataRecord.formatDetected = 'mixed';
      }
    }

    if (dataRecord.hasMixedFormat) {
      mixedFormatCount++;
      dataRecord.status = 'detected_mixed';
    }

    const triggeredRules = evaluateRules(dataRecord);
    triggeredRules.forEach((rule) => {
      if (rule.action === 'flag_for_review') {
        pendingReviewCount++;
        dataRecord.status = 'pending_review';
        dataRecord.reviewAssignee = '活动负责人';
      } else if (rule.action === 'auto_normalize') {
        autoNormalizedCount++;
        dataRecord.status = 'normalized';
        dataRecord.rawValues.forEach((raw, key) => {
          dataRecord.normalizedValues.set(key, raw.numericValue);
        });
      }
    });

    const saveResult = saveRecord(dataRecord);
    if (!saveResult.success) {
      errors.push(`第 ${originalRowNumber} 行保存失败: ${saveResult.errors.join(', ')}`);
      continue;
    }

    importedRecordIds.push(dataRecord.id);

    logAction(importedBy, 'RECORD_IMPORTED', {
      recordId: dataRecord.id,
      originalRowNumber,
      hasMixedFormat: dataRecord.hasMixedFormat,
      formatDetected: dataRecord.formatDetected,
      status: dataRecord.status,
      triggeredRules: triggeredRules.map((r) => r.id),
    }, dataRecord.id);
  }

  logAction(importedBy, 'IMPORT_COMPLETE', {
    sourceFile: sourceFileName,
    importedCount: importedRecordIds.length,
    mixedFormatCount,
    pendingReviewCount,
    autoNormalizedCount,
  });

  return {
    success: errors.length === 0,
    data: {
      totalRows: records.length - dataStartRow,
      importedCount: importedRecordIds.length,
      mixedFormatCount,
      pendingReviewCount,
      autoNormalizedCount,
      errors,
      importedRecordIds,
    },
    errors,
    warnings: [],
  };
}
