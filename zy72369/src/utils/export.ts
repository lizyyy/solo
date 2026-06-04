import type { BendLossRecord, Nameplate, ConflictEntry, ScreenshotAttachment, AuditLog } from '@/types';

interface ExportData {
  exportTime: string;
  nameplates: Nameplate[];
  records: BendLossRecord[];
  conflicts: ConflictEntry[];
  screenshots: Omit<ScreenshotAttachment, 'dataUrl'>[];
  auditLogs: AuditLog[];
}

export function exportAsJSON(
  nameplates: Nameplate[],
  records: BendLossRecord[],
  conflicts: ConflictEntry[],
  screenshots: ScreenshotAttachment[],
  auditLogs: AuditLog[]
): void {
  const data: ExportData = {
    exportTime: new Date().toISOString(),
    nameplates,
    records,
    conflicts,
    screenshots: screenshots.map(({ dataUrl: _, ...rest }) => rest),
    auditLogs,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `光纤弯曲损耗记录_${formatDate()}.json`);
}

export function exportAsCSV(records: BendLossRecord[]): void {
  const header = 'ID,设备编码,弯曲半径(mm),方向,损耗值(dB),录入时间,操作人,状态,是否补录,补录说明,复核结论,复核人';
  const rows = records.map(r =>
    `${r.id},${r.nameplateId},${r.bendRadius},${r.direction},${r.lossValue},${r.recordTime},${r.operator},${r.status},${r.isSupplementary ? '是' : '否'},${r.supplementaryNote || ''},${r.reviewConclusion || ''},${r.reviewer || ''}`
  );
  const csv = '\uFEFF' + header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `光纤弯曲损耗记录_${formatDate()}.csv`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}
