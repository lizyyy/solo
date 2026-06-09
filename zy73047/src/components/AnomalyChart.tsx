import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { SensorLog } from '@/types';
import type { ChartPoint } from '@/types';
import { logsToChartPoints, anomalyTypeLabel, formatDateTime } from '@/lib/utils';

interface Props {
  logs: SensorLog[];
  onPointClick?: (logId: string) => void;
  height?: number;
  threshold?: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as ChartPoint | undefined;
  if (!p) return null;
  const colors = {
    normal: 'text-slate-700',
    anomaly: 'text-red-600 font-semibold',
    gap: 'text-amber-700',
  };
  const labels = { normal: '正常采样', anomaly: '异常采样', gap: '断档无值' };
  return (
    <div className="bg-white border border-slate-300 shadow-md rounded px-3 py-2 text-xs max-w-[280px]">
      <div className="font-semibold text-slate-800 mb-1">
        {p.status === 'gap' ? '⚠️ 采样断档' : labels[p.status]}
        <span className="ml-2 text-slate-500">{p.time}</span>
      </div>
      <div className={colors[p.status]}>
        {p.status === 'gap'
          ? `无采样值（原始见日志）`
          : `原始值：${p.rawValue.toFixed(2)} mm`}
      </div>
      {p.anomalyType && (
        <div className="text-slate-600 mt-0.5">
          类型：{anomalyTypeLabel[p.anomalyType] ?? p.anomalyType}
        </div>
      )}
      {p.avgValue !== undefined && !Number.isNaN(p.rawValue) && (
        <div className="text-blue-700 mt-0.5">
          辅助均值：{p.avgValue.toFixed(2)} mm（仅参考，不参与掩盖）
        </div>
      )}
      <div className="text-slate-500 italic mt-1 leading-snug border-t border-slate-100 pt-1">
        原始说法：{p.rawDescription}
      </div>
      <div className="text-blue-600 mt-1">→ 点击查看传感器日志行</div>
    </div>
  );
};

export default function AnomalyChart({
  logs,
  onPointClick,
  height = 320,
  threshold = 3.5,
}: Props) {
  const data = useMemo(() => logsToChartPoints(logs), [logs]);
  const gapMarkers = useMemo(
    () =>
      data
        .filter((p) => p.status === 'gap')
        .map((p) => ({ x: p.time, label: p.time, logId: p.logId })),
    [data]
  );
  const handleClick = (d: any) => {
    const p = d?.payload as ChartPoint | undefined;
    if (p && onPointClick) onPointClick(p.logId);
  };
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 20, left: 10, bottom: 30 }}
          onClick={handleClick as any}
        >
          <defs>
            <linearGradient id="avgLine" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 4" stroke="#e2e8f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#475569' }}
            tickLine={{ stroke: '#cbd5e1' }}
            interval="preserveStartEnd"
            label={{
              value: '采样时间',
              position: 'insideBottom',
              offset: -16,
              fontSize: 11,
              fill: '#64748b',
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#475569' }}
            tickLine={{ stroke: '#cbd5e1' }}
            label={{
              value: '位移/压力 (mm/MPa)',
              angle: -90,
              position: 'insideLeft',
              offset: 0,
              fontSize: 11,
              fill: '#64748b',
            }}
            domain={['auto', 'auto']}
          />
          <ReferenceLine
            y={threshold}
            stroke="#dc2626"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{
              value: `阈值 ${threshold}`,
              position: 'right',
              fontSize: 10,
              fill: '#dc2626',
            }}
          />
          {gapMarkers.map((g, i) => (
            <ReferenceLine
              key={i}
              x={g.x}
              stroke="#d97706"
              strokeDasharray="2 2"
              strokeOpacity={0.7}
              label={{
                value: '⚠',
                position: 'top',
                fontSize: 14,
                fill: '#d97706',
              }}
            />
          ))}
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }} />
          <Line
            type="monotone"
            dataKey="avgValue"
            stroke="url(#avgLine)"
            strokeWidth={2}
            dot={false}
            strokeOpacity={0.7}
            isAnimationActive={false}
            connectNulls
          />
          <Scatter dataKey="rawValue" isAnimationActive={false}>
            {data.map((p, i) => {
              const fill =
                p.status === 'normal'
                  ? '#3b82f6'
                  : p.status === 'anomaly'
                  ? '#dc2626'
                  : '#d97706';
              return (
                <Cell
                  key={i}
                  fill={fill}
                  stroke={p.status === 'normal' ? 'none' : '#fff'}
                  strokeWidth={2}
                  cursor="pointer"
                />
              );
            })}
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-4 justify-center text-[11px] text-slate-600 mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
          正常采样
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-600 ring-2 ring-white" />
          异常点（独立标记，不被均值掩盖）
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
          采样断档
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 h-0.5 bg-blue-600/60" />
          均值辅助线（仅参考）
        </span>
      </div>
    </div>
  );
}
