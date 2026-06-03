import { db } from '../db';
import type { CoordinateOriginRow, ModificationRecord } from '../types';
import { generateId } from '../utils/checksum';
import {
  generateSupplementCommand,
  generateReviewCommand,
  generateFixMissingRowCommand,
  generateUpdateOcclusionCommand,
} from '../utils/commandGenerator';
import type { AuditLog } from '../types';

export async function addModificationRecord(
  rowId: string,
  field: string,
  oldValue: unknown,
  newValue: unknown,
  operator: '许工' | '安全员'
): Promise<CoordinateOriginRow | undefined> {
  const row = await db.coordinateOrigin.get(rowId);
  if (!row) return undefined;

  const now = Date.now();
  const record: ModificationRecord = {
    field,
    oldValue,
    newValue,
    operator,
    timestamp: now,
  };

  const updatedRow: CoordinateOriginRow = {
    ...row,
    [field]: newValue,
    isManuallyModified: true,
    modificationHistory: [...row.modificationHistory, record],
    updatedAt: now,
  };

  await db.coordinateOrigin.update(rowId, updatedRow);
  return updatedRow;
}

export async function supplementPhotoNumber(
  rowId: string,
  photoNumber: string,
  operator: string
): Promise<{ success: boolean; updatedRow?: CoordinateOriginRow }> {
  const row = await db.coordinateOrigin.get(rowId);
  if (!row) {
    return { success: false };
  }

  const oldValue = row.photoNumber;
  const updatedRow = await addModificationRecord(rowId, 'photoNumber', oldValue, photoNumber, operator as '许工');

  if (updatedRow) {
    const now = Date.now();
    const log: AuditLog = {
      id: generateId('log_'),
      timestamp: now,
      operator,
      actionType: 'supplement',
      action: 'supplement_photo_number',
      message: `补录点位 ${row.photoPointId} 的照片编号：${photoNumber}`,
      rerunnableCommand: generateSupplementCommand(rowId, photoNumber, operator),
      payload: { rowId, oldPhotoNumber: oldValue, newPhotoNumber: photoNumber },
      result: { success: true, updatedRowId: rowId },
      success: true,
      details: {
        photoPointId: row.photoPointId,
        originalLineNumber: row.originalLineNumber,
        oldPhotoNumber: oldValue,
        newPhotoNumber: photoNumber,
      },
      rowReference: `原始行号${row.originalLineNumber}`,
      traceInfo: [{
        action: '补录照片编号',
        operator,
        timestamp: now,
        details: `${oldValue} → ${photoNumber}`,
      }],
    };
    await db.auditLogs.add(log);
  }

  return { success: !!updatedRow, updatedRow };
}

export async function reviewMissingRow(
  rowId: string,
  comment: string,
  operator: string
): Promise<{ success: boolean; updatedRow?: CoordinateOriginRow }> {
  const row = await db.coordinateOrigin.get(rowId);
  if (!row || row.processingStatus !== 'missing_row') {
    return { success: false };
  }

  const now = Date.now();
  const record: ModificationRecord = {
    field: 'processingStatus',
    oldValue: row.processingStatus,
    newValue: 'reviewed',
    operator: operator as '安全员',
    timestamp: now,
  };

  const updatedRow: CoordinateOriginRow = {
    ...row,
    processingStatus: 'reviewed',
    reviewedBy: operator,
    reviewedAt: now,
    isManuallyModified: true,
    modificationHistory: [...row.modificationHistory, record],
    updatedAt: now,
  };

  await db.coordinateOrigin.update(rowId, updatedRow);

  const log: AuditLog = {
    id: generateId('log_'),
    timestamp: now,
    operator,
    actionType: 'review',
    action: 'review_missing_row',
    message: `安全员复核点位 ${row.photoPointId} 的缺行记录，意见：${comment}`,
    rerunnableCommand: generateReviewCommand(rowId, comment, operator),
    payload: { rowId, comment, oldStatus: row.processingStatus, newStatus: 'reviewed' },
    result: { success: true, updatedRowId: rowId },
    success: true,
    details: {
      photoPointId: row.photoPointId,
      originalLineNumber: row.originalLineNumber,
      oldStatus: row.processingStatus,
      newStatus: 'reviewed',
      comment,
    },
    rowReference: `原始行号${row.originalLineNumber}`,
    traceInfo: [{
      action: '安全员复核缺行记录',
      operator,
      timestamp: now,
      details: comment,
    }],
  };
  await db.auditLogs.add(log);

  return { success: true, updatedRow };
}

export async function fixMissingRow(
  rowId: string,
  x: number,
  y: number,
  z: number,
  operator: string
): Promise<{ success: boolean; updatedRow?: CoordinateOriginRow }> {
  const row = await db.coordinateOrigin.get(rowId);
  if (!row) {
    return { success: false };
  }

  const now = Date.now();

  const xRecord: ModificationRecord = {
    field: 'coordinateX',
    oldValue: row.coordinateX,
    newValue: x,
    operator: operator as '许工',
    timestamp: now,
  };

  const yRecord: ModificationRecord = {
    field: 'coordinateY',
    oldValue: row.coordinateY,
    newValue: y,
    operator: operator as '许工',
    timestamp: now,
  };

  const zRecord: ModificationRecord = {
    field: 'coordinateZ',
    oldValue: row.coordinateZ,
    newValue: z,
    operator: operator as '许工',
    timestamp: now,
  };

  const statusRecord: ModificationRecord = {
    field: 'processingStatus',
    oldValue: row.processingStatus,
    newValue: 'supplemented',
    operator: operator as '许工',
    timestamp: now,
  };

  const updatedRow: CoordinateOriginRow = {
    ...row,
    coordinateX: x,
    coordinateY: y,
    coordinateZ: z,
    processingStatus: 'supplemented',
    isManuallyModified: true,
    modificationHistory: [...row.modificationHistory, xRecord, yRecord, zRecord, statusRecord],
    updatedAt: now,
  };

  await db.coordinateOrigin.update(rowId, updatedRow);

  await db.coordinateTable.add({
    id: generateId('ct_'),
    photoPointId: row.photoPointId,
    x,
    y,
    z,
  });

  const log: AuditLog = {
    id: generateId('log_'),
    timestamp: now,
    operator,
    actionType: 'supplement',
    action: 'fix_missing_row',
    message: `补录点位 ${row.photoPointId} 的坐标：X=${x}, Y=${y}, Z=${z}`,
    rerunnableCommand: generateFixMissingRowCommand(rowId, x, y, z, operator),
    payload: { rowId, x, y, z, oldStatus: row.processingStatus, newStatus: 'supplemented' },
    result: { success: true, updatedRowId: rowId },
    success: true,
    details: {
      photoPointId: row.photoPointId,
      originalLineNumber: row.originalLineNumber,
      oldStatus: row.processingStatus,
      newStatus: 'supplemented',
      coordinateX: x,
      coordinateY: y,
      coordinateZ: z,
    },
    rowReference: `原始行号${row.originalLineNumber}`,
    traceInfo: [{
      action: '补录缺失坐标',
      operator,
      timestamp: now,
      details: `X=${x}, Y=${y}, Z=${z}`,
    }],
  };
  await db.auditLogs.add(log);

  return { success: true, updatedRow };
}

export async function updateOcclusionList(
  photoPointIds: string[],
  isOccluded: boolean,
  operator: string
): Promise<{ success: boolean; updatedCount: number }> {
  const now = Date.now();
  let updatedCount = 0;

  await db.transaction('rw', db.occlusionList, db.auditLogs, async () => {
    for (const ppId of photoPointIds) {
      const existing = await db.occlusionList.where('photoPointId').equals(ppId).first();
      if (existing) {
        await db.occlusionList.update(existing.id, {
          isOccluded,
          updatedAt: now,
        });
        updatedCount++;
      }
    }

    const log: AuditLog = {
      id: generateId('log_'),
      timestamp: now,
      operator,
      actionType: 'occlusion_update',
      action: 'update_occlusion_list',
      message: `更新遮挡点清单，共 ${updatedCount} 个点位标记为${isOccluded ? '遮挡' : '可见'}`,
      rerunnableCommand: generateUpdateOcclusionCommand(photoPointIds, operator),
      payload: { photoPointIds, isOccluded },
      result: { success: true, updatedCount },
      success: true,
      details: {
        photoPointIds,
        isOccluded,
        updatedCount,
      },
      traceInfo: [{
        action: '更新遮挡点清单',
        operator,
        timestamp: now,
        details: `${updatedCount}个点位标记为${isOccluded ? '遮挡' : '可见'}`,
      }],
    };
    await db.auditLogs.add(log);
  });

  return { success: true, updatedCount };
}

export async function getModificationHistory(rowId: string): Promise<ModificationRecord[]> {
  const row = await db.coordinateOrigin.get(rowId);
  return row?.modificationHistory || [];
}

export async function getRowTraceInfo(rowId: string): Promise<{
  originalRow: CoordinateOriginRow | undefined;
  history: ModificationRecord[];
  currentStatus: string;
} | null> {
  const row = await db.coordinateOrigin.get(rowId);
  if (!row) return null;

  return {
    originalRow: row,
    history: row.modificationHistory,
    currentStatus: row.processingStatus,
  };
}
