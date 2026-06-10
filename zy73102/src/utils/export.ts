import type { TrackRun, MaterialItem, CollisionPoint, ExportRecord } from '@/types';
import { useTrackStore } from '@/stores/trackStore';

function formatTimestamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}

export function buildFileName(
  batchId: string,
  runNumber: number,
  format: 'csv' | 'json'
): string {
  return `${batchId}_run${runNumber}_${formatTimestamp(new Date())}.${format}`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function materialsToCsv(materials: MaterialItem[]): string {
  const headers = [
    'materialId',
    'standardName',
    'materialType',
    'processingStatus',
    'sourceNoteNumber',
    'drawingVersion',
    'positionX',
    'positionY',
    'positionZ',
  ];
  const rows = materials.map((m) =>
    [
      m.materialId,
      m.standardName,
      m.materialType,
      m.processingStatus,
      m.sourceNoteNumber,
      m.drawingVersion,
      m.position.x,
      m.position.y,
      m.position.z,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function collisionsToCsv(collisions: CollisionPoint[]): string {
  const headers = [
    'collisionId',
    'confidence',
    'involvedMaterialIds',
    'originalQuote',
    'noteParagraphRef',
  ];
  const rows = collisions.map((c) =>
    [
      c.collisionId,
      c.confidence,
      c.involvedMaterialIds.join('|'),
      c.originalQuote,
      c.noteParagraphRef,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export function exportRunData(
  run: TrackRun,
  format: 'csv' | 'json',
  materials: MaterialItem[],
  collisions: CollisionPoint[]
): { fileName: string; fileSize: number } {
  const batchId = run.batchId;
  const fileName = buildFileName(batchId, run.runNumber, format);
  const runMaterials = materials.filter((m) => m.runId === run.runId);
  const runCollisions = collisions.filter((c) => c.runId === run.runId);

  let content: string;
  let blob: Blob;
  let mimeType: string;

  if (format === 'json') {
    mimeType = 'application/json;charset=utf-8';
    const payload = {
      run,
      materials: runMaterials,
      collisions: runCollisions,
      exportedAt: new Date().toISOString(),
    };
    content = JSON.stringify(payload, null, 2);
    blob = new Blob([content], { type: mimeType });
  } else {
    mimeType = 'text/csv;charset=utf-8';
    const csvContent =
      '\uFEFF' +
      `# Run: ${run.runId} | Version: ${run.drawingVersion} | Remark: ${run.remark}\n` +
      `## Materials (${runMaterials.length})\n` +
      materialsToCsv(runMaterials) +
      '\n\n## Collisions\n' +
      collisionsToCsv(runCollisions);
    blob = new Blob([csvContent], { type: mimeType });
  }

  downloadBlob(blob, fileName);

  const fileSize = blob.size;

  const record: ExportRecord = {
    exportId: `EXP-${Date.now()}`,
    fileName,
    exportAt: new Date().toISOString(),
    fileSize,
    batchId,
    runNumber: run.runNumber,
    format,
  };
  useTrackStore.getState().addExportRecord(record);

  return { fileName, fileSize };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
