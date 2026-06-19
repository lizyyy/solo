import { db } from '../db';
import type {
  CanonicalResult,
  AnnotationRow,
  ModificationRecord,
} from '../types';
import { calculateChecksum, generateId } from '../utils/checksum';
import { generateRecalculateCommand } from '../utils/commandGenerator';
import type { AuditLog, SelfCheckResult } from '../types';

function calculate3DCoordinates(
  pixelX: number,
  pixelY: number,
  baseX: number,
  baseY: number,
  baseZ: number
): { x3d: number; y3d: number; z3d: number } {
  const scale = 0.01;
  const offsetX = (pixelX - 200) * scale;
  const offsetY = (pixelY - 150) * scale;
  const offsetZ = Math.sin(pixelX * 0.01) * 0.1;

  return {
    x3d: Math.round((baseX + offsetX) * 100) / 100,
    y3d: Math.round((baseY + offsetY) * 100) / 100,
    z3d: Math.round((baseZ + offsetZ) * 100) / 100,
  };
}

export async function getNextVersion(): Promise<string> {
  const latest = await db.canonicalResults.orderBy('version').reverse().first();
  if (!latest) return 'v1';
  const num = parseInt(latest.version.replace('v', ''), 10);
  return `v${num + 1}`;
}

export async function generateCanonicalResult(
  operator: string
): Promise<{ result: CanonicalResult; isNew: boolean }> {
  const existing = await db.canonicalResults.orderBy('generatedAt').reverse().first();
  const coordinateRows = await db.coordinateOrigin.orderBy('originalLineNumber').toArray();
  const photoPoints = await db.photoPoints.toArray();
  const occlusionList = await db.occlusionList.toArray();

  const ppMap = new Map(photoPoints.map(pp => [pp.id, pp]));
  const occlusionMap = new Map(occlusionList.map(oc => [oc.photoPointId, oc.isOccluded]));

  const now = Date.now();
  const version = await getNextVersion();

  const rows: AnnotationRow[] = [];
  let missingRowCount = 0;

  for (const row of coordinateRows) {
    const pp = ppMap.get(row.photoPointId);
    const isOccluded = occlusionMap.get(row.photoPointId) || false;

    if (row.processingStatus === 'missing_row') {
      missingRowCount++;
    }

    const baseX = row.coordinateX ?? 0;
    const baseY = row.coordinateY ?? 0;
    const baseZ = row.coordinateZ ?? 0;
    const pixelX = pp?.pixelX ?? 0;
    const pixelY = pp?.pixelY ?? 0;

    const { x3d, y3d, z3d } = calculate3DCoordinates(pixelX, pixelY, baseX, baseY, baseZ);

    const existingTrace = existing?.rows.find(r => r.coordinateOriginRowId === row.id);
    const traceInfo = {
      importTime: row.createdAt,
      modificationRecords: row.modificationHistory,
      reviewRecord: row.reviewedBy && row.reviewedAt ? {
        reviewer: row.reviewedBy,
        time: row.reviewedAt,
        comment: '安全员复核确认',
      } : undefined,
      recalculationVersions: existingTrace
        ? [...existingTrace.traceInfo.recalculationVersions, version]
        : [version],
    };

    const annotationRow: AnnotationRow = {
      id: generateId('ar_'),
      crackId: `CRACK-${String(row.originalLineNumber).padStart(3, '0')}`,
      originalLineNumber: row.originalLineNumber,
      photoNumber: row.photoNumber || pp?.photoNumber || '未知',
      x3d,
      y3d,
      z3d,
      status: row.processingStatus,
      isOccluded,
      traceInfo,
      coordinateOriginRowId: row.id,
    };

    rows.push(annotationRow);
  }

  const result: CanonicalResult = {
    version,
    generatedAt: now,
    generatedBy: operator,
    rows,
    checksum: '',
    rowCount: rows.length,
    missingRowCount,
  };

  result.checksum = await calculateChecksum({
    version: result.version,
    generatedAt: result.generatedAt,
    rows: result.rows,
  });

  const isNew = !existing || existing.checksum !== result.checksum;

  if (isNew) {
    await db.transaction('rw', db.canonicalResults, db.auditLogs, async () => {
      await db.canonicalResults.add(result);

      const log: AuditLog = {
        id: generateId('log_'),
        timestamp: now,
        operator,
        actionType: 'recalculate',
        action: 'generate_canonical_result',
        message: `重算完成，生成新版本 ${version}，共 ${rows.length} 条记录，${missingRowCount} 条异常`,
        rerunnableCommand: generateRecalculateCommand(version, operator),
        payload: { version, rowCount: rows.length, missingRowCount },
        result: { success: true, checksum: result.checksum, version },
        success: true,
        details: {
          version,
          rowCount: rows.length,
          missingRowCount,
          checksum: result.checksum,
        },
        traceInfo: [{
          action: '触发重算生成标注结果',
          operator,
          timestamp: now,
          details: `版本${version}`,
        }],
      };
      await db.auditLogs.add(log);
    });
  }

  return { result, isNew };
}

async function transitionSupplementedToRecalculated(operator: string): Promise<{
  updatedCount: number;
  updatedRows: Array<{ originalLineNumber: number; photoPointId: string }>;
}> {
  const now = Date.now();
  const supplementedRows = await db.coordinateOrigin
    .where('processingStatus')
    .equals('supplemented')
    .toArray();

  if (supplementedRows.length === 0) {
    return { updatedCount: 0, updatedRows: [] };
  }

  const updated: Array<{ originalLineNumber: number; photoPointId: string }> = [];

  await db.transaction('rw', db.coordinateOrigin, async () => {
    for (const originRow of supplementedRows) {
      const record: ModificationRecord = {
        field: 'processingStatus',
        oldValue: 'supplemented',
        newValue: 'recalculated',
        operator: operator as '许工' | '安全员' | '系统',
        timestamp: now,
      };
      await db.coordinateOrigin.update(originRow.id, {
        ...originRow,
        processingStatus: 'recalculated',
        modificationHistory: [...originRow.modificationHistory, record],
        updatedAt: now,
      });
      updated.push({
        originalLineNumber: originRow.originalLineNumber,
        photoPointId: originRow.photoPointId,
      });
    }
  });

  return { updatedCount: updated.length, updatedRows: updated };
}

async function syncOcclusionForPhotoPointIds(
  photoPointIds: string[],
  operator: string
): Promise<{ added: number; updated: number }> {
  const now = Date.now();
  let added = 0;
  let updated = 0;

  await db.transaction('rw', db.occlusionList, async () => {
    for (const ppId of photoPointIds) {
      const existing = await db.occlusionList.where('photoPointId').equals(ppId).first();
      if (existing) {
        updated++;
      } else {
        await db.occlusionList.add({
          id: generateId('oc_'),
          photoPointId: ppId,
          isOccluded: false,
          updatedAt: now,
        });
        added++;
      }
    }
  });

  return { added, updated };
}

export async function triggerRecalculation(
  operator: string
): Promise<{
  success: boolean;
  newVersion: string;
  result: CanonicalResult;
  recalculationCheck: SelfCheckResult;
}> {
  const now = Date.now();

  const beforeSupplementCount = await db.coordinateOrigin
    .where('processingStatus')
    .equals('supplemented')
    .count();

  const beforeMissingCount = await db.coordinateOrigin
    .where('processingStatus')
    .equals('missing_row')
    .count();

  const beforeRecalculatedCount = await db.coordinateOrigin
    .where('processingStatus')
    .equals('recalculated')
    .count();

  const photoPointIdsInOrigin = (await db.coordinateOrigin.toArray()).map(r => r.photoPointId);
  const occlusionSync = await syncOcclusionForPhotoPointIds(photoPointIdsInOrigin, operator);

  const transitionResult = await transitionSupplementedToRecalculated(operator);

  const { result, isNew } = await generateCanonicalResult(operator);

  const recalculatedInResult = result.rows.filter(r => r.status === 'recalculated').length;
  const supplementedInResult = result.rows.filter(r => r.status === 'supplemented').length;
  const missingInResult = result.rows.filter(r => r.status === 'missing_row').length;

  const transitionSuccessful = transitionResult.updatedCount === beforeSupplementCount
    && supplementedInResult === 0;

  const passed = beforeSupplementCount === 0 || transitionSuccessful;

  const details: Record<string, unknown> = {
    beforeSupplementCount,
    beforeMissingCount,
    beforeRecalculatedCount,
    transitionedCount: transitionResult.updatedCount,
    transitionedRows: transitionResult.updatedRows,
    occlusionAdded: occlusionSync.added,
    occlusionUpdated: occlusionSync.updated,
    afterRecalculatedCount: recalculatedInResult,
    afterSupplementCount: supplementedInResult,
    afterMissingCount: missingInResult,
    isNewResult: isNew,
    version: result.version,
    checksum: result.checksum,
    rowCount: result.rowCount,
    missingRowCount: result.missingRowCount,
  };

  const message = passed
    ? (beforeSupplementCount > 0
        ? `重算成功：${transitionResult.updatedCount} 条补录记录已转为已重算，共 ${result.rowCount} 条记录（版本 ${result.version}）`
        : `重算成功：无待重算补录记录，共 ${result.rowCount} 条记录（版本 ${result.version}）`)
    : `重算校验失败：${beforeSupplementCount} 条补录记录中仅 ${transitionResult.updatedCount} 条完成状态转换`;

  const recalculationCheck: SelfCheckResult = {
    type: 'recalculation',
    passed,
    checkedAt: now,
    details,
    message,
  };

  await db.selfCheckResults.put(recalculationCheck);

  if (!passed) {
    return {
      success: false,
      newVersion: result.version,
      result,
      recalculationCheck,
    };
  }

  const log: AuditLog = {
    id: generateId('log_'),
    timestamp: now,
    operator,
    actionType: 'recalculate',
    action: 'trigger_recalculation',
    message,
    rerunnableCommand: generateRecalculateCommand(result.version, operator),
    payload: { version: result.version, beforeSupplementCount },
    result: {
      success: true,
      transitionedCount: transitionResult.updatedCount,
      version: result.version,
      checksum: result.checksum,
    },
    success: true,
    details,
    rowReference: transitionResult.updatedRows.length > 0
      ? `原始行号${transitionResult.updatedRows.map(r => r.originalLineNumber).join(', ')}`
      : undefined,
    traceInfo: [{
      action: '触发重算',
      operator,
      timestamp: now,
      details: message,
    }],
  };
  await db.auditLogs.add(log);

  return {
    success: true,
    newVersion: result.version,
    result,
    recalculationCheck,
  };
}

export async function getLatestCanonicalResult(): Promise<CanonicalResult | null> {
  const latest = await db.canonicalResults.orderBy('generatedAt').reverse().first();
  return latest || null;
}

export async function getCanonicalResultVersion(version: string): Promise<CanonicalResult | null> {
  const result = await db.canonicalResults.get(version);
  return result || null;
}
