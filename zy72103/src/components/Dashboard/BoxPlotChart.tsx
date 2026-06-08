import { useMemo } from 'react';
import { useDataStore } from '@/store/useDataStore';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
} from 'recharts';
import { FIELD_UNITS } from '@/config/thresholds';
import { BarChart3 } from 'lucide-react';

export function BoxPlotChartComponent() {
  const { records } = useDataStore();

  const boxPlotData = useMemo(() => {
    const normalTemps = records
      .filter((r) => r.temperature !== null && !r.dataQuality.isExtreme)
      .map((r) => r.temperature!);
    const extremeTemps = records
      .filter((r) => r.temperature !== null && r.dataQuality.isExtreme)
      .map((r) => r.temperature!);

    if (normalTemps.length === 0) return [];

    const sorted = [...normalTemps].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    return [
      {
        name: '温度分布',
        min,
        q1,
        median,
        q3,
        max,
        outliers: extremeTemps,
      },
    ];
  }, [records]);

  const scatterData = useMemo(() => {
    return records
      .filter((r) => r.temperature !== null)
      .map((r) => ({
        x: '温度分布',
        y: r.temperature,
        isExtreme: r.dataQuality.isExtreme,
        id: r.id,
      }));
  }, [records]);

  if (records.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-slate-200">温度分布箱线图</h3>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              type="category"
              dataKey="x"
              stroke="#64748B"
              tick={{ fill: '#94A3B8', fontSize: 12 }}
            />
            <YAxis
              stroke="#64748B"
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              domain={[20, 100]}
              label={{
                value: `温度 (${FIELD_UNITS.temperature})`,
                angle: -90,
                position: 'insideLeft',
                fill: '#94A3B8',
                style: { textAnchor: 'middle', fontSize: 12 },
              }}
            />
            <Tooltip
              content={({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
                      <div className="font-mono text-sm text-slate-300 mb-1">{data.id}</div>
                      <div className={`font-mono text-lg font-bold ${data.isExtreme ? 'text-red-400' : 'text-emerald-400'}`}>
                        {data.y.toFixed(1)} {FIELD_UNITS.temperature}
                      </div>
                      {data.isExtreme && (
                        <div className="text-xs text-red-400 mt-1">⚠️ 极端值</div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            {boxPlotData.map((data, index) => (
              <g key={index}>
                <line
                  x1={175}
                  y1={20 + (95 - data.max) * 1.8}
                  x2={175}
                  y2={20 + (95 - data.min) * 1.8}
                  stroke="#8B5CF6"
                  strokeWidth={2}
                />
                <line
                  x1={155}
                  y1={20 + (95 - data.max) * 1.8}
                  x2={195}
                  y2={20 + (95 - data.max) * 1.8}
                  stroke="#8B5CF6"
                  strokeWidth={2}
                />
                <line
                  x1={155}
                  y1={20 + (95 - data.min) * 1.8}
                  x2={195}
                  y2={20 + (95 - data.min) * 1.8}
                  stroke="#8B5CF6"
                  strokeWidth={2}
                />
                <rect
                  x={140}
                  y={20 + (95 - data.q3) * 1.8}
                  width={70}
                  height={(data.q3 - data.q1) * 1.8}
                  fill="#8B5CF6"
                  fillOpacity={0.3}
                  stroke="#7C3AED"
                  strokeWidth={2}
                />
                <line
                  x1={140}
                  y1={20 + (95 - data.median) * 1.8}
                  x2={210}
                  y2={20 + (95 - data.median) * 1.8}
                  stroke="#10B981"
                  strokeWidth={3}
                />
              </g>
            ))}

            <Scatter
              data={scatterData}
              fill="#10B981"
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={payload.isExtreme ? 5 : 3}
                    fill={payload.isExtreme ? '#DC2626' : '#10B981'}
                    stroke={payload.isExtreme ? '#991B1B' : '#059669'}
                    strokeWidth={2}
                    className={payload.isExtreme ? 'animate-pulse' : ''}
                  />
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {boxPlotData.length > 0 && (
        <div className="grid grid-cols-5 gap-3 mt-4 text-center">
          <div className="bg-slate-900/50 rounded-lg p-2">
            <div className="text-xs text-slate-500">最小值</div>
            <div className="font-mono text-slate-300">{boxPlotData[0].min.toFixed(1)}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2">
            <div className="text-xs text-slate-500">Q1</div>
            <div className="font-mono text-slate-300">{boxPlotData[0].q1.toFixed(1)}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2">
            <div className="text-xs text-slate-500">中位数</div>
            <div className="font-mono text-emerald-400">{boxPlotData[0].median.toFixed(1)}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2">
            <div className="text-xs text-slate-500">Q3</div>
            <div className="font-mono text-slate-300">{boxPlotData[0].q3.toFixed(1)}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2">
            <div className="text-xs text-slate-500">最大值</div>
            <div className="font-mono text-slate-300">{boxPlotData[0].max.toFixed(1)}</div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-3 text-center">
        箱线图展示排除极端值后的四分位分布 · 红色点为极端值
      </p>
    </div>
  );
}
