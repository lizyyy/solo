import { db } from '../db';
import type { CoordinateOriginRow, PhotoPoint, CoordinateTableEntry } from '../types';
import { generateId } from '../utils/checksum';
import { generateImportCommand } from '../utils/commandGenerator';
import type { AuditLog } from '../types';

export interface ImportResult {
  success: boolean;
  duplicateDetected: boolean;
  missingRows: string[];
  importedRows: CoordinateOriginRow[];
  fileHash?: string;
}

export async function parseCoordinateOriginCSV(content: string): Promise<Array<{
  lineNumber: number;
  photoPointId: string;
  photoNumber?: string;
  x?: number;
  y?: number;
  z?: number;
}>> {
  const lines = content.trim().split('\n');
  const rows: Array<{
    lineNumber: number;
    photoPointId: string;
    photoNumber?: string;
    x?: number;
    y?: number;
    z?: number;
  }> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length < 2) continue;

    const lineNumber = parseInt(values[0].trim(), 10) || i;
    const photoPointId = values[1]?.trim();
    const photoNumber = values[2]?.trim() || undefined;
    const x = values[3] ? parseFloat(values[3].trim()) : undefined;
    const y = values[4] ? parseFloat(values[4].trim()) : undefined;
    const z = values[5] ? parseFloat(values[5].trim()) : undefined;

    if (photoPointId) {
      rows.push({ lineNumber, photoPointId, photoNumber, x, y, z });
    }
  }

  return rows;
}

export async function detectDuplicateImport(content: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash;
  }
  const fileHash = Math.abs(hash).toString(16);

  const existingLog = await db.auditLogs
    .where('action')
    .equals('import_coordinate_origin')
    .reverse()
    .first();

  if (existingLog && existingLog.payload.fileHash === fileHash) {
    return true;
  }
  return false;
}

export async function detectMissingRows(): Promise<string[]> {
  const photoPoints = await db.photoPoints.toArray();
  const photoPointsWithPoint = photoPoints.filter(pp => pp.hasPoint === true);
  const coordinateTable = await db.coordinateTable.toArray();
  const coordinateIds = new Set(coordinateTable.map(ct => ct.photoPointId));

  const missing: string[] = [];
  for (const pp of photoPointsWithPoint) {
    if (!coordinateIds.has(pp.id)) {
      missing.push(pp.id);
    }
  }
  return missing;
}

export async function importCoordinateOrigin(
  content: string,
  fileName: string,
  operator: string
): Promise<ImportResult> {
  const duplicateDetected = await detectDuplicateImport(content);

  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash;
  }
  const fileHash = Math.abs(hash).toString(16);

  const parsedRows = await parseCoordinateOriginCSV(content);
  const photoPoints = await db.photoPoints.toArray();
  const coordinateTable = await db.coordinateTable.toArray();
  const coordMap = new Map(coordinateTable.map(ct => [ct.photoPointId, ct]));
  const ppMap = new Map(photoPoints.map(pp => [pp.id, pp]));

  const missingPhotoPointIds = await detectMissingRows();
  const missingSet = new Set(missingPhotoPointIds);

  const now = Date.now();
  const importedRows: CoordinateOriginRow[] = [];

  for (const parsed of parsedRows) {
    const pp = ppMap.get(parsed.photoPointId);
    const coord = coordMap.get(parsed.photoPointId);

    const isMissing = missingSet.has(parsed.photoPointId);
    const hasCoordinate = parsed.x !== undefined && parsed.y !== undefined && parsed.z !== undefined;

    const row: CoordinateOriginRow = {
      id: generateId('co_'),
      originalLineNumber: parsed.lineNumber,
      currentLineNumber: parsed.lineNumber,
      photoPointId: parsed.photoPointId,
      photoNumber: parsed.photoNumber || pp?.photoNumber,
      coordinateX: hasCoordinate ? parsed.x : coord?.x,
      coordinateY: hasCoordinate ? parsed.y : coord?.y,
      coordinateZ: hasCoordinate ? parsed.z : coord?.z,
      isManuallyModified: false,
      modificationHistory: [{
        field: 'import',
        oldValue: null,
        newValue: 'imported',
        operator: '系统',
        timestamp: now,
      }],
      processingStatus: isMissing ? 'missing_row' : 'imported',
      createdAt: now,
      updatedAt: now,
    };

    importedRows.push(row);
  }

  if (!duplicateDetected) {
    await db.transaction('rw', db.coordinateOrigin, db.auditLogs, async () => {
      await db.coordinateOrigin.bulkAdd(importedRows);

      const log: AuditLog = {
        id: generateId('log_'),
        timestamp: now,
        operator,
        actionType: 'import',
        action: 'import_coordinate_origin',
        message: `导入坐标原点说明文件：${fileName}，共${importedRows.length}行${missingPhotoPointIds.length > 0 ? `，检测到${missingPhotoPointIds.length}条缺行记录` : ''}`,
        rerunnableCommand: generateImportCommand(fileName, operator),
        payload: { fileName, fileHash, rowCount: importedRows.length },
        result: {
          success: true,
          duplicateDetected,
          missingRows: missingPhotoPointIds,
          importedRowIds: importedRows.map(r => r.id),
        },
        success: true,
        details: {
          fileName,
          fileHash,
          rowCount: importedRows.length,
          missingRowCount: missingPhotoPointIds.length,
          missingRowIds: missingPhotoPointIds,
        },
        rowReference: missingPhotoPointIds.length > 0 ? missingPhotoPointIds.join(', ') : undefined,
        traceInfo: [{
          action: '导入坐标原点说明',
          operator,
          timestamp: now,
          details: fileName,
        }],
      };
      await db.auditLogs.add(log);
    });
  }

  return {
    success: !duplicateDetected,
    duplicateDetected,
    missingRows: missingPhotoPointIds,
    importedRows,
    fileHash,
  };
}
