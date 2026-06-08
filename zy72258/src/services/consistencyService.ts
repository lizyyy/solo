import { db } from '../db';
import { calculateChecksum, generateId } from '../utils/checksum';
import { generateExportCommand, generateSelfCheckCommand } from '../utils/commandGenerator';
import type { SelfCheckType, SelfCheckResult, CanonicalResult, AuditLog } from '../types';
import { getLatestCanonicalResult } from './recalculationService';
import * as XLSX from 'xlsx';

export interface ConsistencyCheckResult {
  pageMatchesApi: boolean;
  pageMatchesExport: boolean;
  apiMatchesExport: boolean;
  allConsistent: boolean;
  details: {
    pageDataHash: string;
    apiDataHash: string;
    exportDataHash: string;
    pageRowCount: number;
    apiRowCount: number;
    exportRowCount: number;
  };
}

function prepareExportData(rows: CanonicalResult['rows']) {
  return rows.map(row => ({
    裂缝编号: row.crackId,
    原始行号: row.originalLineNumber,
    照片编号: row.photoNumber,
    X坐标: row.x3d,
    Y坐标: row.y3d,
    Z坐标: row.z3d,
    处理状态: row.status,
    是否遮挡: row.isOccluded ? '是' : '否',
  }));
}

async function simulateApiResponse(): Promise<{
  data: CanonicalResult['rows'] | null;
  hash: string;
  rowCount: number;
  version: string;
}> {
  const canonicalResult = await getLatestCanonicalResult();
  if (!canonicalResult) {
    return { data: null, hash: '', rowCount: 0, version: '' };
  }
  const serialized = JSON.parse(JSON.stringify(canonicalResult.rows));
  const hash = await calculateChecksum(serialized);
  return {
    data: serialized,
    hash,
    rowCount: serialized.length,
    version: canonicalResult.version,
  };
}

function generateCSVContent(data: ReturnType<typeof prepareExportData>): string {
  const headers = Object.keys(data[0] || {}).join(',');
  const rows = data.map(row =>
    Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  );
  return [headers, ...rows].join('\n');
}

export async function checkConsistency(
  operator: string
): Promise<ConsistencyCheckResult & { selfCheckResult: SelfCheckResult }> {
  const canonicalResult = await getLatestCanonicalResult();

  if (!canonicalResult) {
    return {
      pageMatchesApi: false,
      pageMatchesExport: false,
      apiMatchesExport: false,
      allConsistent: false,
      details: {
        pageDataHash: '',
        apiDataHash: '',
        exportDataHash: '',
        pageRowCount: 0,
        apiRowCount: 0,
        exportRowCount: 0,
      },
      selfCheckResult: {
        type: 'export_consistency',
        passed: false,
        checkedAt: Date.now(),
        details: { error: '无可用标注结果' },
        message: '无可用标注结果，请先生成',
      },
    };
  }

  const pageData = canonicalResult.rows;
  const apiResponse = await simulateApiResponse();
  const apiData = apiResponse.data;
  const exportData = prepareExportData(canonicalResult.rows);

  const pageDataHash = await calculateChecksum(pageData);
  const apiDataHash = apiResponse.hash;
  const exportDataHash = await calculateChecksum(exportData);

  const pageMatchesApi = pageDataHash === apiDataHash;
  const pageMatchesExport = pageData.length === exportData.length && pageDataHash === exportDataHash;
  const apiMatchesExport = apiDataHash === exportDataHash;
  const allConsistent = pageMatchesApi && pageMatchesExport && apiMatchesExport;

  const now = Date.now();
  const selfCheckResult: SelfCheckResult = {
    type: 'export_consistency',
    passed: allConsistent,
    checkedAt: now,
    details: {
      pageDataHash,
      apiDataHash,
      exportDataHash,
      pageRowCount: pageData.length,
      apiRowCount: apiResponse.rowCount,
      exportRowCount: exportData.length,
      pageMatchesApi,
      pageMatchesExport,
      apiMatchesExport,
      canonicalChecksum: canonicalResult.checksum,
      version: canonicalResult.version,
    },
    message: allConsistent
      ? '一致性校验通过：页面、接口、导出读取同一份数据'
      : '一致性校验失败：页面、接口或导出数据不一致',
  };

  await db.transaction('rw', db.selfCheckResults, db.auditLogs, async () => {
    await db.selfCheckResults.put(selfCheckResult);

    const log: AuditLog = {
      id: generateId('log_'),
      timestamp: now,
      operator,
      actionType: 'self_check',
      action: 'check_consistency',
      message: allConsistent
        ? '导出一致性校验通过：页面、接口、导出读取同一份数据'
        : '导出一致性校验失败：页面、接口或导出数据不一致',
      rerunnableCommand: generateSelfCheckCommand('export_consistency', operator),
      payload: { type: 'export_consistency' },
      result: {
        success: allConsistent,
        pageMatchesApi,
        pageMatchesExport,
        apiMatchesExport,
      },
      success: allConsistent,
      details: {
        pageDataHash,
        apiDataHash,
        exportDataHash,
        pageMatchesApi,
        pageMatchesExport,
        apiMatchesExport,
      },
      traceInfo: [{
        action: '运行导出一致性自检',
        operator,
        timestamp: now,
        details: allConsistent ? '校验通过' : '校验失败',
      }],
    };
    await db.auditLogs.add(log);
  });

  return {
    pageMatchesApi,
    pageMatchesExport,
    apiMatchesExport,
    allConsistent,
    details: {
      pageDataHash,
      apiDataHash,
      exportDataHash,
      pageRowCount: pageData.length,
      apiRowCount: apiResponse.rowCount,
      exportRowCount: exportData.length,
    },
    selfCheckResult,
  };
}

export async function runSelfCheck(
  type: SelfCheckType,
  operator: string
): Promise<SelfCheckResult> {
  const now = Date.now();

  switch (type) {
    case 'duplicate_import': {
      const lastImport = await db.auditLogs
        .where('action')
        .equals('import_coordinate_origin')
        .reverse()
        .first();

      const importCount = await db.auditLogs
        .where('action')
        .equals('import_coordinate_origin')
        .count();

      const hasDuplicate = lastImport?.result.duplicateDetected === true;

      const result: SelfCheckResult = {
        type,
        passed: !hasDuplicate,
        checkedAt: now,
        details: {
          importCount,
          lastImportTime: lastImport?.timestamp,
          lastDuplicateDetected: lastImport?.result.duplicateDetected,
          lastFileHash: lastImport?.payload.fileHash,
        },
        message: hasDuplicate
          ? '检测到重复导入，请检查导入文件'
          : `重复导入检测通过，共导入 ${importCount} 次`,
      };

      await db.transaction('rw', db.selfCheckResults, db.auditLogs, async () => {
        await db.selfCheckResults.put(result);

        const log: AuditLog = {
          id: generateId('log_'),
          timestamp: now,
          operator,
          actionType: 'self_check',
          action: 'self_check_duplicate_import',
          message: hasDuplicate
            ? '重复导入检测失败：检测到重复导入'
            : `重复导入检测通过，共导入 ${importCount} 次`,
          rerunnableCommand: generateSelfCheckCommand('duplicate_import', operator),
          payload: { type },
          result: { success: !hasDuplicate, details: result.details },
          success: !hasDuplicate,
          details: result.details,
          traceInfo: [{
            action: '运行重复导入自检',
            operator,
            timestamp: now,
            details: hasDuplicate ? '检测到重复' : '检测通过',
          }],
        };
        await db.auditLogs.add(log);
      });

      return result;
    }

    case 'missing_row': {
      const coordinateRows = await db.coordinateOrigin.toArray();
      const missingRows = coordinateRows.filter(r => r.processingStatus === 'missing_row');
      const reviewedRows = coordinateRows.filter(r => r.processingStatus === 'reviewed');

      const passed = missingRows.length === 0;

      const result: SelfCheckResult = {
        type,
        passed,
        checkedAt: now,
        details: {
          totalRows: coordinateRows.length,
          missingRowCount: missingRows.length,
          reviewedRowCount: reviewedRows.length,
          missingRowIds: missingRows.map(r => r.id),
          missingPhotoPointIds: missingRows.map(r => r.photoPointId),
          missingOriginalLineNumbers: missingRows.map(r => r.originalLineNumber),
        },
        message: passed
          ? '坐标表完整，无缺行记录'
          : `检测到 ${missingRows.length} 条缺行记录待安全员复核，${reviewedRows.length} 条已复核待补录`,
      };

      await db.transaction('rw', db.selfCheckResults, db.auditLogs, async () => {
        await db.selfCheckResults.put(result);

        const log: AuditLog = {
          id: generateId('log_'),
          timestamp: now,
          operator,
          actionType: 'self_check',
          action: 'self_check_missing_row',
          message: passed
            ? '坐标表完整，无缺行记录'
            : `检测到 ${missingRows.length} 条缺行记录待安全员复核`,
          rerunnableCommand: generateSelfCheckCommand('missing_row', operator),
          payload: { type },
          result: { success: passed, details: result.details },
          success: passed,
          details: result.details,
          rowReference: missingRows.length > 0 ? `原始行号${missingRows.map(r => r.originalLineNumber).join(', ')}` : undefined,
          traceInfo: [{
            action: '运行坐标表缺行自检',
            operator,
            timestamp: now,
            details: passed ? '检测通过' : `检测到${missingRows.length}条缺行`,
          }],
        };
        await db.auditLogs.add(log);
      });

      return result;
    }

    case 'recalculation': {
      const coordinateRows = await db.coordinateOrigin.toArray();
      const supplementedRows = coordinateRows.filter(r => r.processingStatus === 'supplemented');
      const recalculatedRows = coordinateRows.filter(r => r.processingStatus === 'recalculated');
      const canonicalResult = await getLatestCanonicalResult();

      let passed = false;
      let message = '';

      if (supplementedRows.length === 0 && recalculatedRows.length === 0) {
        passed = true;
        message = '补录后重算校验通过：无补录待重算记录';
      } else if (supplementedRows.length > 0) {
        passed = false;
        message = `补录后重算校验失败：仍有 ${supplementedRows.length} 条补录记录未完成重算`;
      } else {
        if (canonicalResult) {
          const supplementedInResult = canonicalResult.rows.filter(
            r => r.status === 'supplemented' || r.status === 'recalculated'
          );
          const allRecalculated = supplementedInResult.every(r => r.status === 'recalculated');
          passed = allRecalculated;
          message = allRecalculated
            ? `补录后重算校验通过：${recalculatedRows.length} 条补录记录已全部完成重算`
            : `补录后重算校验失败：标注结果中仍有未完成重算的补录记录`;
        } else {
          passed = false;
          message = '补录后重算校验失败：无可用标注结果';
        }
      }

      const result: SelfCheckResult = {
        type,
        passed,
        checkedAt: now,
        details: {
          supplementedCount: supplementedRows.length,
          recalculatedCount: recalculatedRows.length,
          supplementedIds: supplementedRows.map(r => r.photoPointId),
          recalculatedIds: recalculatedRows.map(r => r.photoPointId),
          canonicalVersion: canonicalResult?.version,
          canonicalChecksum: canonicalResult?.checksum,
        },
        message,
      };

      await db.transaction('rw', db.selfCheckResults, db.auditLogs, async () => {
        await db.selfCheckResults.put(result);

        const log: AuditLog = {
          id: generateId('log_'),
          timestamp: now,
          operator,
          actionType: 'self_check',
          action: 'self_check_recalculation',
          message,
          rerunnableCommand: generateSelfCheckCommand('recalculation', operator),
          payload: { type },
          result: { success: passed, details: result.details },
          success: passed,
          details: result.details,
          rowReference: supplementedRows.length > 0
            ? `原始行号${supplementedRows.map(r => r.originalLineNumber).join(', ')}`
            : undefined,
          traceInfo: [{
            action: '运行补录后重算自检',
            operator,
            timestamp: now,
            details: passed ? '校验通过' : `校验失败，${supplementedRows.length}条未重算`,
          }],
        };
        await db.auditLogs.add(log);
      });

      return result;
    }

    case 'export_consistency': {
      const checkResult = await checkConsistency(operator);
      return checkResult.selfCheckResult;
    }
  }
}

export async function exportData(
  format: 'xlsx' | 'csv',
  operator: string
): Promise<Blob> {
  const canonicalResult = await getLatestCanonicalResult();
  if (!canonicalResult) {
    throw new Error('无可用标注结果，请先生成');
  }

  const exportData = prepareExportData(canonicalResult.rows);
  let blob: Blob;

  if (format === 'csv') {
    const csvContent = generateCSVContent(exportData);
    blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  } else {
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '标注结果');

    const traceSheet = XLSX.utils.json_to_sheet(
      canonicalResult.rows.map(row => ({
        裂缝编号: row.crackId,
        原始行号: row.originalLineNumber,
        导入时间: new Date(row.traceInfo.importTime).toLocaleString('zh-CN'),
        改动次数: row.traceInfo.modificationRecords.length,
        复核人: row.traceInfo.reviewRecord?.reviewer || '-',
        复核时间: row.traceInfo.reviewRecord?.time
          ? new Date(row.traceInfo.reviewRecord.time).toLocaleString('zh-CN')
          : '-',
        重算版本: row.traceInfo.recalculationVersions.join(', '),
      }))
    );
    XLSX.utils.book_append_sheet(workbook, traceSheet, '追溯信息');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  const now = Date.now();
  const log: AuditLog = {
    id: generateId('log_'),
    timestamp: now,
    operator,
    actionType: 'export',
    action: `export_${format}`,
    message: `导出${format.toUpperCase()}格式标注结果，版本：${canonicalResult.version}，共 ${exportData.length} 条记录`,
    rerunnableCommand: generateExportCommand(format, operator),
    payload: { format, rowCount: exportData.length, version: canonicalResult.version },
    result: { success: true, checksum: canonicalResult.checksum },
    success: true,
    details: {
      format,
      rowCount: exportData.length,
      version: canonicalResult.version,
      checksum: canonicalResult.checksum,
    },
    traceInfo: [{
      action: `导出${format.toUpperCase()}格式结果`,
      operator,
      timestamp: now,
      details: `版本${canonicalResult.version}`,
    }],
  };
  await db.auditLogs.add(log);

  return blob;
}

export async function downloadExport(
  format: 'xlsx' | 'csv',
  operator: string,
  fileName: string
): Promise<void> {
  const blob = await exportData(format, operator);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getAllSelfCheckResults(): Promise<SelfCheckResult[]> {
  return db.selfCheckResults.orderBy('checkedAt').reverse().toArray();
}

export async function getLatestSelfCheckResults(): Promise<Record<SelfCheckType, SelfCheckResult | null>> {
  const types: SelfCheckType[] = ['duplicate_import', 'missing_row', 'recalculation', 'export_consistency'];
  const results: Record<SelfCheckType, SelfCheckResult | null> = {
    duplicate_import: null,
    missing_row: null,
    recalculation: null,
    export_consistency: null,
  };

  for (const type of types) {
    const latest = await db.selfCheckResults.where('type').equals(type).reverse().first();
    results[type] = latest || null;
  }

  return results;
}
