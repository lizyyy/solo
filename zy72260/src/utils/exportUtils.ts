import html2canvas from 'html2canvas';
import md5 from 'blueimp-md5';
import {
  ExportRecord,
  PointCloudLog,
  SafetyRadiusTable,
  Route,
  ConflictRecord,
  HistoryCompareResult,
} from '@/types';
import { db } from '@/db';

export async function captureScreenshot(
  elementId: string,
  watermark: string
): Promise<string> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.textAlign = 'right';
    
    const lines = watermark.split('\n');
    lines.forEach((line, idx) => {
      ctx.fillText(
        line,
        canvas.width - 20,
        canvas.height - 20 - idx * 20
      );
    });
  }

  return canvas.toDataURL('image/png');
}

export function generateWatermark(
  operator: string,
  exportTime: string,
  version: string
): string {
  const date = new Date(exportTime);
  const formattedDate = date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  
  return `导出人：${operator}\n导出时间：${formattedDate}\n版本：${version}`;
}

export function generateVersion(exports: ExportRecord[]): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const todayExports = exports.filter((e) => e.exportTime.startsWith(dateStr.slice(0, 10)));
  const seq = String(todayExports.length + 1).padStart(3, '0');
  return `v${dateStr}-${seq}`;
}

export async function createExportRecord(params: {
  imageDataUrl: string;
  watermark: string;
  version: string;
  operator: string;
  pointCloudLog: PointCloudLog | null;
  safetyRadiusTable: SafetyRadiusTable | null;
  routes: Route[];
  conflicts: ConflictRecord[];
  remark?: string;
}): Promise<ExportRecord> {
  const {
    imageDataUrl,
    watermark,
    version,
    operator,
    pointCloudLog,
    safetyRadiusTable,
    routes,
    conflicts,
    remark,
  } = params;

  const dataHash = calculateExportHash(
    pointCloudLog,
    safetyRadiusTable,
    routes,
    conflicts
  );

  const exportRecord: ExportRecord = {
    id: `export_${Date.now()}`,
    version,
    exportTime: new Date().toISOString(),
    operator,
    imageDataUrl,
    watermark,
    dataHash,
    routeLength: routes.reduce((sum, r) => sum + r.calculatedLength, 0),
    exhibitCount: pointCloudLog?.exhibits.length || 0,
    conflictCount: conflicts.filter((c) => c.status === 'pending').length,
    pendingReviewCount: routes.filter((r) => r.reviewStatus === 'pending').length,
    remark,
  };

  await db.exports.put(exportRecord);

  return exportRecord;
}

function calculateExportHash(
  pointCloudLog: PointCloudLog | null,
  safetyRadiusTable: SafetyRadiusTable | null,
  routes: Route[],
  conflicts: ConflictRecord[]
): string {
  const data = {
    pointCloud: pointCloudLog?.exhibits.map((e) => ({
      id: e.exhibitId,
      x: e.x,
      y: e.y,
      radius: e.safetyRadius || e.pointCloudRadius,
      source: e.radiusSource,
    })),
    safetyTable: safetyRadiusTable?.exhibits.map((e) => ({
      id: e.exhibitId,
      radius: e.safetyRadius,
    })),
    routes: routes.map((r) => ({
      id: r.id,
      waypoints: r.waypoints,
      length: r.calculatedLength,
      isSupplementary: r.isSupplementary,
      reviewStatus: r.reviewStatus,
    })),
    conflicts: conflicts.map((c) => ({
      id: c.id,
      status: c.status,
      decision: c.decision,
    })),
  };
  
  return md5(JSON.stringify(data));
}

export async function compareWithHistory(
  currentExport: ExportRecord,
  exportHistory: ExportRecord[]
): Promise<HistoryCompareResult> {
  const previousExport = exportHistory.find(
    (e) => e.id !== currentExport.id
  );

  const differences: HistoryCompareResult['differences'] = [];

  if (previousExport) {
    if (Math.abs(currentExport.routeLength - previousExport.routeLength) > 0.01) {
      differences.push({
        type: 'length',
        field: 'routeLength',
        oldValue: previousExport.routeLength,
        newValue: currentExport.routeLength,
        description: `动线总长度：${previousExport.routeLength.toFixed(2)}m → ${currentExport.routeLength.toFixed(2)}m`,
      });
    }

    if (currentExport.exhibitCount !== previousExport.exhibitCount) {
      differences.push({
        type: 'exhibit',
        field: 'exhibitCount',
        oldValue: previousExport.exhibitCount,
        newValue: currentExport.exhibitCount,
        description: `展柜数量：${previousExport.exhibitCount} → ${currentExport.exhibitCount}`,
      });
    }

    if (currentExport.conflictCount !== previousExport.conflictCount) {
      differences.push({
        type: 'status',
        field: 'conflictCount',
        oldValue: previousExport.conflictCount,
        newValue: currentExport.conflictCount,
        description: `待处理冲突：${previousExport.conflictCount} → ${currentExport.conflictCount}`,
      });
    }

    if (currentExport.pendingReviewCount !== previousExport.pendingReviewCount) {
      differences.push({
        type: 'status',
        field: 'pendingReviewCount',
        oldValue: previousExport.pendingReviewCount,
        newValue: currentExport.pendingReviewCount,
        description: `待复核项：${previousExport.pendingReviewCount} → ${currentExport.pendingReviewCount}`,
      });
    }

    if (currentExport.dataHash !== previousExport.dataHash) {
      differences.push({
        type: 'data',
        field: 'dataHash',
        oldValue: previousExport.dataHash,
        newValue: currentExport.dataHash,
        description: '数据内容发生变化',
      });
    }
  }

  const result: HistoryCompareResult = {
    id: `compare_${Date.now()}`,
    currentExportId: currentExport.id,
    previousExportId: previousExport?.id,
    isConsistent: differences.length === 0,
    differences,
    compareTime: new Date().toISOString(),
  };

  return result;
}

export function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateExportFilename(
  version: string,
  projectName: string = '博物馆展柜动线模拟'
): string {
  const sanitizedProject = projectName.replace(/[<>:"/\\|?*]/g, '');
  return `${sanitizedProject}_${version}.png`;
}

export function generateChangeLog(compareResult: HistoryCompareResult): string {
  if (compareResult.isConsistent) {
    return '本次导出与上一版本内容完全一致。';
  }

  const lines = ['本次导出变更说明：', ''];
  compareResult.differences.forEach((diff, idx) => {
    lines.push(`${idx + 1}. ${diff.description}`);
  });

  return lines.join('\n');
}
