import type { ChartPoint, ScheduleConclusion, HandoffStatus, SensorLog } from '@/types';

export const cn = (...args: (string | false | null | undefined)[]) =>
  args.filter(Boolean).join(' ');

export const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const conclusionMeta: Record<
  ScheduleConclusion,
  { label: string; cls: string; dot: string }
> = {
  normal: { label: '正常', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  anomaly: { label: '异常', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  pending: { label: '待判定', cls: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-500' },
  rejudged_normal: { label: '改判正常', cls: 'bg-amber-50 text-amber-700 border-amber-300', dot: 'bg-amber-500' },
  rejudged_anomaly: { label: '改判异常', cls: 'bg-rose-50 text-rose-700 border-rose-300', dot: 'bg-rose-500' },
};

export const handoffMeta: Record<
  HandoffStatus,
  { label: string; cls: string; bg: string }
> = {
  releasable: { label: '可放行', cls: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  missing_material: { label: '缺材料', cls: 'text-amber-800', bg: 'bg-amber-50 border-amber-300' },
  pending: { label: '待确认', cls: 'text-slate-700', bg: 'bg-slate-50 border-slate-300' },
};

export const anomalyTypeLabel: Record<string, string> = {
  over_threshold: '超限',
  spike: '尖峰',
  drift: '漂移',
  sensor_offline: '离线断档',
};

export const logsToChartPoints = (logs: SensorLog[]): ChartPoint[] => {
  const sorted = [...logs].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  const normals = sorted.filter((l) => l.status === 'normal');
  const avgPool = normals.length ? normals : sorted.filter((l) => l.status !== 'gap');
  const avg =
    avgPool.length > 0
      ? avgPool.reduce((s, l) => s + (l.rawValue > 0 ? l.rawValue : 0), 0) /
        avgPool.filter((l) => l.rawValue > 0).length
      : 0;
  return sorted.map((l) => ({
    time: formatTime(l.timestamp),
    timestamp: +new Date(l.timestamp),
    rawValue: l.status === 'gap' ? NaN : l.rawValue,
    avgValue: avg,
    status: l.status,
    anomalyType: l.anomalyType,
    logId: l.id,
    rawDescription: l.rawDescription,
  }));
};

export const logsToCsv = (logs: SensorLog[]): string => {
  const header = ['ID', '时间', '传感器', '支座编号', '原始值(mm/MPa)', '状态', '异常类型', '原始说明', '材料批次'];
  const rows = logs.map((l) =>
    [
      l.id,
      l.timestamp,
      l.sensorId,
      l.bearingCode,
      l.status === 'gap' ? '(断档无值)' : l.rawValue.toString(),
      l.status,
      l.anomalyType ?? '',
      `"${l.rawDescription.replace(/"/g, '""')}"`,
      l.materialBatchNo ?? '',
    ].join(',')
  );
  return [header.join(','), ...rows].join('\n');
};

export const downloadFile = (filename: string, content: string, mime = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const uid = (p = 'x') =>
  `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
