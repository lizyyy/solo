import type { BendLossRecord, Nameplate, ConflictEntry, ScreenshotAttachment, AuditLog } from '@/types';

interface ExportRecord extends BendLossRecord {
  equipmentCode: string;
}

interface ExportConflict extends ConflictEntry {
  equipmentCode: string;
}

interface ExportScreenshot extends Omit<ScreenshotAttachment, 'dataUrl'> {
  equipmentCode: string;
}

interface ExportData {
  exportTime: string;
  nameplates: Nameplate[];
  records: ExportRecord[];
  conflicts: ExportConflict[];
  screenshots: ExportScreenshot[];
  auditLogs: AuditLog[];
}

export function exportAsJSON(
  nameplates: Nameplate[],
  records: BendLossRecord[],
  conflicts: ConflictEntry[],
  screenshots: ScreenshotAttachment[],
  auditLogs: AuditLog[]
): void {
  const npMap = new Map(nameplates.map(n => [n.id, n.equipmentCode]));
  const recMap = new Map(records.map(r => [r.id, r.nameplateId]));

  const getCode = (nameplateId: string) => npMap.get(nameplateId) || nameplateId.slice(0, 10);
  const getCodeByRecId = (recordId: string) => {
    const npId = recMap.get(recordId);
    return npId ? getCode(npId) : recordId.slice(0, 10);
  };

  const data: ExportData = {
    exportTime: new Date().toISOString(),
    nameplates,
    records: records.map(r => ({ ...r, equipmentCode: getCode(r.nameplateId) })),
    conflicts: conflicts.map(c => ({ ...c, equipmentCode: getCodeByRecId(c.recordId) })),
    screenshots: screenshots.map(({ dataUrl, ...rest }) => {
      void dataUrl;
      return {
        ...rest,
        equipmentCode: getCodeByRecId(rest.recordId),
      };
    }),
    auditLogs,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `光纤弯曲损耗记录_${formatDate()}.json`);
}

export function exportAsCSV(records: BendLossRecord[], nameplates: Nameplate[]): void {
  const npMap = new Map(nameplates.map(n => [n.id, n.equipmentCode]));
  const header = 'ID,设备编码,弯曲半径(mm),方向,损耗值(dB),录入时间,操作人,状态,是否补录,补录说明,复核结论,复核人';
  const rows = records.map(r => {
    const equipmentCode = npMap.get(r.nameplateId) || r.nameplateId.slice(0, 10);
    return `${r.id},${equipmentCode},${r.bendRadius},${r.direction},${r.lossValue},${r.recordTime},${r.operator},${r.status},${r.isSupplementary ? '是' : '否'},${r.supplementaryNote || ''},${r.reviewConclusion || ''},${r.reviewer || ''}`;
  });
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
