import type { AbnormalAlert } from '../types';
import { SEVERITY_LABEL, STATUS_LABEL } from '../types';

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function fileTimestamp(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `_${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}

export function generateCsv(rows: AbnormalAlert[], maxJudgmentVersion: number): string {
  const headers = [
    '提醒ID',
    '提醒日期',
    '宠物名',
    '品种',
    '主人',
    '主人电话',
    '减重比例(%)',
    '异常等级',
    '处理状态',
    '负责人',
    '判断版本',
    '判断快照',
    '是否已读',
    '时间线条目数',
    '备注条数',
    '疫苗照批次数',
    '最新操作时间',
    'CSV导出版本签名',
  ];
  const versionSig = `v${maxJudgmentVersion}_exportedAt_${fileTimestamp()}`;
  const lines: string[] = [headers.map(csvEscape).join(',')];
  for (const a of rows) {
    const tl = a.timeline ?? [];
    const photoBatches = new Set(
      tl.flatMap((t) => (t.photos ?? []).map((p) => p.batchNumber)),
    ).size;
    const lastOp = tl.length ? tl[tl.length - 1].createdAt : a.alertDate;
    lines.push(
      [
        a.id,
        a.alertDate,
        a.pet?.name ?? '',
        `${a.pet?.species ?? ''} ${a.pet?.breed ?? ''}`.trim(),
        a.pet?.ownerName ?? '',
        a.pet?.ownerPhone ?? '',
        a.weightLossPct.toFixed(1),
        SEVERITY_LABEL[a.severity],
        STATUS_LABEL[a.currentStatus],
        a.assignedTo,
        a.judgmentVersion,
        a.judgmentSnapshot,
        a.isRead ? '是' : '否',
        tl.length,
        (a.notes ?? []).length,
        photoBatches,
        lastOp,
        versionSig,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}

export function downloadCsv(filename: string, content: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
