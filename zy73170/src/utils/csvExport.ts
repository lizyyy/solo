import type { StudentSample } from '../types';

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildVerdictRows(samples: StudentSample[]): string[][] {
  const needSupplement = samples.filter((s) => s.finalVerdict === '需补材料');
  const duplicates = samples.filter(
    (s) => s.isDuplicate && s.finalVerdict !== '需补材料' && s.finalVerdict !== '可放行',
  );
  const passed = samples.filter((s) => s.finalVerdict === '可放行');

  const header = [
    '组别', '学号', '姓名', '题目', '结果摘要',
    '状态', '重复标记', '重复关联样本ID', '审核备注', '提交时间',
  ];

  const buildRow = (group: string, s: StudentSample): string[] => [
    group,
    s.studentId,
    s.studentName,
    s.problemTitle,
    s.resultSummary,
    s.status,
    s.isDuplicate ? '[重复]' : '',
    s.duplicateOf || '',
    s.reviewNote || '',
    s.submittedAt,
  ];

  return [
    header,
    ...needSupplement.map((s) => buildRow('需补材料', s)),
    ...duplicates.map((s) => buildRow('重复待确认', s)),
    ...passed.map((s) => buildRow('可放行', s)),
  ];
}

export function exportVerdicts(samples: StudentSample[]) {
  const rows = buildVerdictRows(samples);

  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `图论路径批量验算_结论清单_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
