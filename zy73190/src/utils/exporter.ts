import type { Sample, Note, ParamVersion, FilterState } from '@/types';

const statusLabels: Record<string, string> = {
  normal: '正常',
  abnormal: '异常',
  duplicate: '重复',
  pending: '待确认',
};

const noteTypeLabels: Record<string, string> = {
  score: '评分备注',
  supplement: '补充备注',
  conclusion: '结论备注',
};

export function filterSamples(
  samples: Sample[],
  filters: FilterState
): Sample[] {
  return samples.filter((sample) => {
    if (filters.status.length > 0 && !filters.status.includes(sample.status)) {
      return false;
    }
    if (
      filters.sampleCode &&
      !sample.sampleCode.toLowerCase().includes(filters.sampleCode.toLowerCase())
    ) {
      return false;
    }
    if (filters.dateRange) {
      const sampleDate = new Date(sample.createdAt);
      const startDate = new Date(filters.dateRange[0]);
      const endDate = new Date(filters.dateRange[1]);
      if (sampleDate < startDate || sampleDate > endDate) {
        return false;
      }
    }
    return true;
  });
}

export function exportToCSV(
  samples: Sample[],
  notes: Note[],
  paramVersion: ParamVersion,
  filters: FilterState
): string {
  const filteredSamples = filterSamples(samples, filters);

  const headers = [
    '样本编号',
    '状态',
    '递推序列',
    '预期值',
    '计算值',
    '偏差(%)',
    '阈值(%)',
    '是否重复',
    '关联重复样本',
    '评分备注',
    '所有备注摘要',
    '计算口径',
    '参数版本',
    '递推公式',
    '验算时间',
    '最后更新',
  ];

  const rows = filteredSamples.map((sample) => {
    const sampleNotes = notes.filter((n) => n.sampleId === sample.id);
    const notesSummary = sampleNotes
      .map((n) => `[${noteTypeLabels[n.type]}] ${n.content}`)
      .join(' | ');

    const isDuplicate = sample.duplicateOf.length > 0;
    const duplicateCodes = sample.duplicateOf
      .map((id) => {
        const s = samples.find((x) => x.id === id);
        return s?.sampleCode || id;
      })
      .join('; ');

    const calcNote = isDuplicate
      ? '样本序列重复'
      : sample.deviation > paramVersion.threshold
      ? `偏差${sample.deviation.toFixed(2)}%超过阈值${paramVersion.threshold}%`
      : `偏差${sample.deviation.toFixed(2)}%在阈值内`;

    return [
      sample.sampleCode,
      statusLabels[sample.status],
      sample.sequence.join(', '),
      sample.expected.toString(),
      sample.actual.toFixed(2),
      sample.deviation.toFixed(2),
      paramVersion.threshold.toString(),
      isDuplicate ? '是' : '否',
      duplicateCodes || '-',
      sample.scoreNote,
      notesSummary || '-',
      calcNote,
      paramVersion.name,
      paramVersion.formula,
      sample.createdAt,
      sample.updatedAt,
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const BOM = '\uFEFF';
  return BOM + csvContent;
}

export function downloadCSV(
  samples: Sample[],
  notes: Note[],
  paramVersion: ParamVersion,
  filters: FilterState
): void {
  const csvContent = exportToCSV(samples, notes, paramVersion, filters);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const statusStr = filters.status.length > 0 ? `_${filters.status.join('-')}` : '';
  link.setAttribute('download', `数列递推验算_${paramVersion.id}_${dateStr}${statusStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
