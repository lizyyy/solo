import { db } from '../db';
import type {
  CanonicalResult,
  AnnotationRow,
  CoordinateOriginRow,
  OcclusionEntry,
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

    const traceInfo = {
      importTime: row.createdAt,
      modificationRecords: row.modificationHistory,
      reviewRecord: row.reviewedBy && row.reviewedAt ? {
        reviewer: row.reviewedBy,
        time: row.reviewedAt,
        comment: '安全员复核确认',
      } : undefined,
      recalculationVersions: existing
        ? [...(existing.rows.find(r => r.coordinateOriginRowId === row.id)?.traceInfo.recalculationVersions || []), version]
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

export async function triggerRecalculation(
  operator: string
): Promise<{
  success: boolean;
  newVersion: string;
  result: CanonicalResult;
  recalculationCheck: SelfCheckResult;
}> {
  const { result, isNew } = await generateCanonicalResult(operator);

  const beforeRows = await db.coordinateOrigin.where('processingStatus').equals('supplemented').count();
  const afterRows = result.rows.filter(r => r.status === 'recalculated').length;
  const passed = beforeRows === 0 || afterRows > 0;

  const now = Date.now();
  const recalculationCheck: SelfCheckResult = {
    type: 'recalculation',
    passed,
    checkedAt: now,
    details: {
      beforeSupplementCount: beforeRows,
      afterRecalculatedCount: afterRows,
      isNewResult: isNew,
      version: result.version,
      checksum: result.checksum,
    },
    message: passed
      ? `重算成功，共处理 ${result.rowCount} 条记录，其中异常 ${result.missingRowCount} 条`
      : '重算校验失败：补录记录未正确转换为重算状态',
  };

  await db.selfCheckResults.put(recalculationCheck);

  if (passed) {
    await db.transaction('rw', db.coordinateOrigin, async () => {
      for (const row of result.rows) {
        const originRow = await db.coordinateOrigin.get(row.coordinateOriginRowId);
        if (originRow && originRow.processingStatus === 'supplemented') {
          const record: ModificationRecord = {
            field: 'processingStatus',
            oldValue: 'supplemented',
            newValue: 'recalculated',
            operator: '系统',
            timestamp: now,
          };
          await db.coordinateOrigin.update(row.coordinateOriginRowId, {
            ...originRow,
            processingStatus: 'recalculated',
            modificationHistory: [...originRow.modificationHistory, record],
            updatedAt: now,
          });
        }
      }
    });

    const { result: updatedResult } = await generateCanonicalResult(operator);
    return {
      success: true,
      newVersion: updatedResult.version,
      result: updatedResult,
      recalculationCheck,
    };
  }

  return {
    success: false,
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
