import { db } from '../db';
import { calculateChecksum, generateId } from '../utils/checksum';
import { generateExportCommand, generateSelfCheckCommand } from '../utils/commandGenerator';
import type { SelfCheckType, SelfCheckResult, CanonicalResult, AuditLog, AnnotationRow, ProcessingStatus } from '../types';
import { getLatestCanonicalResult } from './recalculationService';
import * as XLSX from 'xlsx';
import { PROCESSING_STATUS_LABELS } from '../types';

const FIELD_LABELS: Record<keyof AnnotationRow, string> = {
  id: '记录ID',
  crackId: '裂缝编号',
  originalLineNumber: '原始行号',
  photoNumber: '照片编号',
  x3d: 'X坐标',
  y3d: 'Y坐标',
  z3d: 'Z坐标',
  status: '处理状态',
  isOccluded: '是否遮挡',
  traceInfo: '追溯信息',
  coordinateOriginRowId: '源行ID',
};

const COMPARE_FIELDS: Array<keyof AnnotationRow> = [
  'crackId', 'originalLineNumber', 'photoNumber', 'x3d', 'y3d', 'z3d', 'status', 'isOccluded'
];

export interface NormalizedRow {
  crackId: string;
  originalLineNumber: number;
  photoNumber: string;
  x3d: number;
  y3d: number;
  z3d: number;
  status: ProcessingStatus;
  isOccluded: boolean;
}

export interface FieldDiff {
  field: string;
  fieldLabel: string;
  pageValue: unknown;
  apiValue: unknown;
  exportValue: unknown;
}

export interface RowDiff {
  originalLineNumber: number;
  crackId: string;
  inPage: boolean;
  inApi: boolean;
  inExport: boolean;
  fieldDiffs: FieldDiff[];
}

export interface ConsistencyCheckResult {
  pageMatchesApi: boolean;
  pageMatchesExport: boolean;
  apiMatchesExport: boolean;
  allConsistent: boolean;
  details: {
    pageRowCount: number;
    apiRowCount: number;
    exportRowCount: number;
    pageDataHash: string;
    apiDataHash: string;
    exportDataHash: string;
    missingRowsInExport: number[];
    missingRowsInApi: number[];
    missingRowsInPage: number[];
    mismatchedRows: RowDiff[];
    consistentCount: number;
    inconsistentCount: number;
    canonicalVersion: string;
    canonicalChecksum: string;
  };
}

function normalizeAnnotationRow(row: AnnotationRow): NormalizedRow {
  return {
    crackId: row.crackId,
    originalLineNumber: row.originalLineNumber,
    photoNumber: row.photoNumber,
    x3d: typeof row.x3d === 'number' ? Math.round(row.x3d * 100) / 100 : row.x3d,
    y3d: typeof row.y3d === 'number' ? Math.round(row.y3d * 100) / 100 : row.y3d,
    z3d: typeof row.z3d === 'number' ? Math.round(row.z3d * 100) / 100 : row.z3d,
    status: row.status,
    isOccluded: row.isOccluded,
  };
}

function prepareExportData(rows: CanonicalResult['rows']) {
  return rows.map(row => ({
    裂缝编号: row.crackId,
    原始行号: row.originalLineNumber,
    照片编号: row.photoNumber,
    X坐标: typeof row.x3d === 'number' ? Math.round(row.x3d * 100) / 100 : row.x3d,
    Y坐标: typeof row.y3d === 'number' ? Math.round(row.y3d * 100) / 100 : row.y3d,
    Z坐标: typeof row.z3d === 'number' ? Math.round(row.z3d * 100) / 100 : row.z3d,
    处理状态: PROCESSING_STATUS_LABELS[row.status] || row.status,
    是否遮挡: row.isOccluded ? '是' : '否',
  }));
}

function normalizeExportRow(exportRow: Record<string, unknown>): NormalizedRow {
  const statusLabel = String(exportRow['处理状态'] ?? '');
  const statusEntries = Object.entries(PROCESSING_STATUS_LABELS) as Array<[ProcessingStatus, string]>;
  const matchedStatus = statusEntries.find(([, label]) => label === statusLabel)?.[0] || (exportRow['处理状态'] as ProcessingStatus);
  return {
    crackId: String(exportRow['裂缝编号'] ?? ''),
    originalLineNumber: Number(exportRow['原始行号'] ?? 0),
    photoNumber: String(exportRow['照片编号'] ?? ''),
    x3d: Number(exportRow['X坐标'] ?? 0),
    y3d: Number(exportRow['Y坐标'] ?? 0),
    z3d: Number(exportRow['Z坐标'] ?? 0),
    status: matchedStatus,
    isOccluded: exportRow['是否遮挡'] === '是' || exportRow['是否遮挡'] === true,
  };
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

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.round(a * 100) / 100 === Math.round(b * 100) / 100;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
  return String(a) === String(b);
}

function compareRows(
  pageMap: Map<number, NormalizedRow>,
  apiMap: Map<number, NormalizedRow>,
  exportMap: Map<number, NormalizedRow>
): {
  pageMatchesApi: boolean;
  pageMatchesExport: boolean;
  apiMatchesExport: boolean;
  rowDiffs: RowDiff[];
  missingRowsInExport: number[];
  missingRowsInApi: number[];
  missingRowsInPage: number[];
} {
  const allLineNumbers = new Set<number>([
    ...pageMap.keys(),
    ...apiMap.keys(),
    ...exportMap.keys(),
  ]);

  const rowDiffs: RowDiff[] = [];
  let pageMatchesApi = true;
  let pageMatchesExport = true;
  let apiMatchesExport = true;
  const missingRowsInExport: number[] = [];
  const missingRowsInApi: number[] = [];
  const missingRowsInPage: number[] = [];

  for (const lineNo of allLineNumbers) {
    const pRow = pageMap.get(lineNo);
    const aRow = apiMap.get(lineNo);
    const eRow = exportMap.get(lineNo);

    const inPage = !!pRow;
    const inApi = !!aRow;
    const inExport = !!eRow;

    if (!inExport && (inPage || inApi)) missingRowsInExport.push(lineNo);
    if (!inApi && (inPage || inExport)) missingRowsInApi.push(lineNo);
    if (!inPage && (inApi || inExport)) missingRowsInPage.push(lineNo);

    if (!inPage || !inApi || !inExport) {
      pageMatchesApi = pageMatchesApi && inPage && inApi;
      pageMatchesExport = pageMatchesExport && inPage && inExport;
      apiMatchesExport = apiMatchesExport && inApi && inExport;
      rowDiffs.push({
        originalLineNumber: lineNo,
        crackId: pRow?.crackId || aRow?.crackId || eRow?.crackId || '',
        inPage,
        inApi,
        inExport,
        fieldDiffs: [],
      });
      continue;
    }

    const fieldDiffs: FieldDiff[] = [];

    for (const field of COMPARE_FIELDS) {
      const pVal = (pRow as NormalizedRow)[field];
      const aVal = (aRow as NormalizedRow)[field];
      const eVal = (eRow as NormalizedRow)[field];

      const pEqA = valuesEqual(pVal, aVal);
      const pEqE = valuesEqual(pVal, eVal);
      const aEqE = valuesEqual(aVal, eVal);

      if (!pEqA || !pEqE || !aEqE) {
        if (!pEqA) pageMatchesApi = false;
        if (!pEqE) pageMatchesExport = false;
        if (!aEqE) apiMatchesExport = false;
        fieldDiffs.push({
          field,
          fieldLabel: FIELD_LABELS[field] || field,
          pageValue: pVal,
          apiValue: aVal,
          exportValue: eVal,
        });
      }
    }

    if (fieldDiffs.length > 0) {
      rowDiffs.push({
        originalLineNumber: lineNo,
        crackId: pRow?.crackId || '',
        inPage,
        inApi,
        inExport,
        fieldDiffs,
      });
    }
  }

  return {
    pageMatchesApi,
    pageMatchesExport,
    apiMatchesExport,
    rowDiffs,
    missingRowsInExport,
    missingRowsInApi,
    missingRowsInPage,
  };
}

function generateCSVContent(data: ReturnType<typeof prepareExportData>): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row =>
    Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  );
  return [headers, ...rows].join('\n');
}

function buildReadableDetails(
  compareResult: ReturnType<typeof compareRows>,
  pageRowCount: number,
  apiRowCount: number,
  exportRowCount: number,
  pageDataHash: string,
  apiDataHash: string,
  exportDataHash: string,
  canonicalVersion: string,
  canonicalChecksum: string
): ConsistencyCheckResult['details'] {
  const mismatchedRows = compareResult.rowDiffs.filter(r => r.fieldDiffs.length > 0 || !r.inPage || !r.inApi || !r.inExport);
  const consistentCount = Math.min(pageRowCount, apiRowCount, exportRowCount) - mismatchedRows.length;

  return {
    pageRowCount,
    apiRowCount,
    exportRowCount,
    pageDataHash,
    apiDataHash,
    exportDataHash,
    missingRowsInExport: compareResult.missingRowsInExport,
    missingRowsInApi: compareResult.missingRowsInApi,
    missingRowsInPage: compareResult.missingRowsInPage,
    mismatchedRows,
    consistentCount: Math.max(0, consistentCount),
    inconsistentCount: mismatchedRows.length,
    canonicalVersion,
    canonicalChecksum,
  };
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
        pageRowCount: 0,
        apiRowCount: 0,
        exportRowCount: 0,
        pageDataHash: '',
        apiDataHash: '',
        exportDataHash: '',
        missingRowsInExport: [],
        missingRowsInApi: [],
        missingRowsInPage: [],
        mismatchedRows: [],
        consistentCount: 0,
        inconsistentCount: 0,
        canonicalVersion: '',
        canonicalChecksum: '',
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
  const apiData = apiResponse.data || [];
  const exportData = prepareExportData(canonicalResult.rows);

  const pageMap = new Map(pageData.map(r => [r.originalLineNumber, normalizeAnnotationRow(r)]));
  const apiMap = new Map(apiData.map(r => [r.originalLineNumber, normalizeAnnotationRow(r)]));
  const exportMap = new Map(exportData.map(r => [Number(r['原始行号']), normalizeExportRow(r as Record<string, unknown>)]));

  const compareResult = compareRows(pageMap, apiMap, exportMap);
  const allConsistent = compareResult.pageMatchesApi && compareResult.pageMatchesExport && compareResult.apiMatchesExport;

  const pageDataHash = await calculateChecksum([...pageMap.values()]);
  const apiDataHash = apiResponse.hash;
  const exportDataHash = await calculateChecksum([...exportMap.values()]);

  const details = buildReadableDetails(
    compareResult,
    pageData.length,
    apiResponse.rowCount,
    exportData.length,
    pageDataHash,
    apiDataHash,
    exportDataHash,
    canonicalResult.version,
    canonicalResult.checksum
  );

  const now = Date.now();

  const humanReadableMessage = buildConsistencyMessage(allConsistent, details);

  const selfCheckResult: SelfCheckResult = {
    type: 'export_consistency',
    passed: allConsistent,
    checkedAt: now,
    details,
    message: humanReadableMessage,
  };

  await db.transaction('rw', db.selfCheckResults, db.auditLogs, async () => {
    await db.selfCheckResults.put(selfCheckResult);

    const log: AuditLog = {
      id: generateId('log_'),
      timestamp: now,
      operator,
      actionType: 'self_check',
      action: 'check_consistency',
      message: humanReadableMessage,
      rerunnableCommand: generateSelfCheckCommand('export_consistency', operator),
      payload: { type: 'export_consistency' },
      result: {
        success: allConsistent,
        pageMatchesApi: compareResult.pageMatchesApi,
        pageMatchesExport: compareResult.pageMatchesExport,
        apiMatchesExport: compareResult.apiMatchesExport,
      },
      success: allConsistent,
      details,
      traceInfo: [{
        action: '运行导出一致性自检',
        operator,
        timestamp: now,
        details: allConsistent ? '校验通过' : `存在${details.inconsistentCount}处不一致`,
      }],
    };
    await db.auditLogs.add(log);
  });

  return {
    pageMatchesApi: compareResult.pageMatchesApi,
    pageMatchesExport: compareResult.pageMatchesExport,
    apiMatchesExport: compareResult.apiMatchesExport,
    allConsistent,
    details,
    selfCheckResult,
  };
}

function buildConsistencyMessage(allConsistent: boolean, details: ConsistencyCheckResult['details']): string {
  if (allConsistent) {
    return `一致性校验通过：共 ${details.consistentCount} 条记录，页面、接口、导出字段完全一致（版本 ${details.canonicalVersion}）`;
  }
  const parts: string[] = [];
  if (details.missingRowsInExport.length > 0) parts.push(`导出缺行：行号${details.missingRowsInExport.join(',')}`);
  if (details.missingRowsInApi.length > 0) parts.push(`接口缺行：行号${details.missingRowsInApi.join(',')}`);
  if (details.missingRowsInPage.length > 0) parts.push(`页面缺行：行号${details.missingRowsInPage.join(',')}`);
  if (details.mismatchedRows.length > 0) {
    const diffSummary = details.mismatchedRows
      .slice(0, 3)
      .map(r => `行${r.originalLineNumber}(${r.fieldDiffs.map(f => f.fieldLabel).join('/')})`)
      .join('；');
    parts.push(`字段不一致：${diffSummary}${details.mismatchedRows.length > 3 ? `等${details.mismatchedRows.length}处` : ''}`);
  }
  return `一致性校验失败：${parts.join('；')}`;
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

      const importLogs = await db.auditLogs
        .where('action')
        .equals('import_coordinate_origin')
        .reverse()
        .toArray();

      const hasDuplicate = lastImport?.result.duplicateDetected === true;

      const details: Record<string, unknown> = {
        importCount: importLogs.length,
        lastImportTime: lastImport?.timestamp,
        lastImportFileName: lastImport?.payload.fileName,
        lastDuplicateDetected: lastImport?.result.duplicateDetected,
        lastFileHash: lastImport?.payload.fileHash,
        importHistory: importLogs.map(log => ({
          time: log.timestamp,
          fileName: log.payload.fileName,
          fileHash: log.payload.fileHash,
          duplicateDetected: log.result.duplicateDetected,
          rowCount: log.payload.rowCount,
        })),
      };

      const result: SelfCheckResult = {
        type,
        passed: !hasDuplicate,
        checkedAt: now,
        details,
        message: hasDuplicate
          ? `检测到重复导入：${lastImport?.payload.fileName || '未知文件'} 已导入过`
          : `重复导入检测通过，共导入 ${importLogs.length} 次，无重复`,
      };

      await db.transaction('rw', db.selfCheckResults, db.auditLogs, async () => {
        await db.selfCheckResults.put(result);

        const log: AuditLog = {
          id: generateId('log_'),
          timestamp: now,
          operator,
          actionType: 'self_check',
          action: 'self_check_duplicate_import',
          message: result.message,
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
      const coordinateRows = await db.coordinateOrigin.orderBy('originalLineNumber').toArray();
      const missingRows = coordinateRows.filter(r => r.processingStatus === 'missing_row');
      const reviewedRows = coordinateRows.filter(r => r.processingStatus === 'reviewed');

      const passed = missingRows.length === 0;

      const details: Record<string, unknown> = {
        totalRows: coordinateRows.length,
        missingRowCount: missingRows.length,
        reviewedRowCount: reviewedRows.length,
        missingRows: missingRows.map(r => ({
          originalLineNumber: r.originalLineNumber,
          photoPointId: r.photoPointId,
          photoNumber: r.photoNumber || '(未补录)',
          status: r.processingStatus,
          hasCoordinate: r.coordinateX !== undefined && r.coordinateY !== undefined && r.coordinateZ !== undefined,
          reviewedBy: r.reviewedBy || null,
        })),
        reviewedRows: reviewedRows.map(r => ({
          originalLineNumber: r.originalLineNumber,
          photoPointId: r.photoPointId,
          photoNumber: r.photoNumber || '(未补录)',
          reviewedBy: r.reviewedBy,
          reviewedAt: r.reviewedAt,
        })),
        normalRowCount: coordinateRows.length - missingRows.length - reviewedRows.length,
      };

      const result: SelfCheckResult = {
        type,
        passed,
        checkedAt: now,
        details,
        message: passed
          ? `坐标表完整，共 ${coordinateRows.length} 条记录，无缺行待复核`
          : `检测到 ${missingRows.length} 条缺行待安全员复核，${reviewedRows.length} 条已复核待补录`,
      };

      await db.transaction('rw', db.selfCheckResults, db.auditLogs, async () => {
        await db.selfCheckResults.put(result);

        const log: AuditLog = {
          id: generateId('log_'),
          timestamp: now,
          operator,
          actionType: 'self_check',
          action: 'self_check_missing_row',
          message: result.message,
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
      const coordinateRows = await db.coordinateOrigin.orderBy('originalLineNumber').toArray();
      const supplementedRows = coordinateRows.filter(r => r.processingStatus === 'supplemented');
      const recalculatedRows = coordinateRows.filter(r => r.processingStatus === 'recalculated');
      const reviewedRows = coordinateRows.filter(r => r.processingStatus === 'reviewed');
      const canonicalResult = await getLatestCanonicalResult();

      let passed = false;
      let message = '';

      const statusBreakdown = coordinateRows.reduce<Record<string, number>>((acc, r) => {
        acc[r.processingStatus] = (acc[r.processingStatus] || 0) + 1;
        return acc;
      }, {});

      const supplementedWithHistory = supplementedRows.map(r => ({
        originalLineNumber: r.originalLineNumber,
        photoPointId: r.photoPointId,
        photoNumber: r.photoNumber || '(未补录)',
        coordinate: r.coordinateX !== undefined && r.coordinateY !== undefined && r.coordinateZ !== undefined
          ? `(${r.coordinateX?.toFixed(2)}, ${r.coordinateY?.toFixed(2)}, ${r.coordinateZ?.toFixed(2)})`
          : '(坐标不完整)',
        lastModification: r.modificationHistory[r.modificationHistory.length - 1] || null,
      }));

      const recalculatedWithHistory = recalculatedRows.map(r => ({
        originalLineNumber: r.originalLineNumber,
        photoPointId: r.photoPointId,
        photoNumber: r.photoNumber || '(未补录)',
        coordinate: `(${r.coordinateX?.toFixed(2)}, ${r.coordinateY?.toFixed(2)}, ${r.coordinateZ?.toFixed(2)})`,
        recalculatedAt: r.updatedAt,
      }));

      if (supplementedRows.length === 0 && recalculatedRows.length === 0 && reviewedRows.length === 0) {
        passed = true;
        message = '补录后重算校验通过：无补录待重算记录';
      } else if (supplementedRows.length > 0) {
        passed = false;
        message = `补录后重算校验失败：仍有 ${supplementedRows.length} 条补录记录（行号${supplementedRows.map(r => r.originalLineNumber).join(',')}）未完成重算`;
      } else {
        if (canonicalResult) {
          const inCanonicalStatuses = new Set(canonicalResult.rows.map(r => r.status));
          const supplementedInResult = canonicalResult.rows.filter(
            r => r.status === 'supplemented' || r.status === 'recalculated'
          );
          const allRecalculated = supplementedInResult.every(r => r.status === 'recalculated')
            && !inCanonicalStatuses.has('supplemented');
          passed = allRecalculated;
          message = allRecalculated
            ? `补录后重算校验通过：${recalculatedRows.length} 条补录记录已全部完成重算，标注结果版本 ${canonicalResult.version}`
            : `补录后重算校验失败：标注结果中仍存在 supplemented 状态记录`;
        } else {
          passed = false;
          message = '补录后重算校验失败：无可用标注结果，请先触发重算';
        }
      }

      const details: Record<string, unknown> = {
        statusBreakdown,
        supplementedCount: supplementedRows.length,
        recalculatedCount: recalculatedRows.length,
        reviewedCount: reviewedRows.length,
        supplementedRows: supplementedWithHistory,
        recalculatedRows: recalculatedWithHistory,
        canonicalVersion: canonicalResult?.version || null,
        canonicalChecksum: canonicalResult?.checksum || null,
        canonicalMissingRowCount: canonicalResult?.missingRowCount,
        canonicalRowCount: canonicalResult?.rowCount,
      };

      const result: SelfCheckResult = {
        type,
        passed,
        checkedAt: now,
        details,
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
