import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ZAxis,
} from 'recharts';
import type { PressureDataPoint, AnalysisConclusion } from '@/types';
import { THRESHOLDS } from '@/types';
import { formatTime, getLevelColor, getLevelLabel } from '@/utils/helpers';
import { useUIStore } from '@/stores/uiStore';

interface PressureWaveformProps {
  data: PressureDataPoint[];
  conclusions?: AnalysisConclusion[];
  height?: number;
  showThresholds?: boolean;
  interactive?: boolean;
}

interface ChartDataPoint extends PressureDataPoint {
  timeLabel: string;
  isConclusion?: boolean;
  conclusionLevel?: string;
  conclusionId?: string;
}

export const PressureWaveform: React.FC<PressureWaveformProps> = ({
  data,
  conclusions = [],
  height = 400,
  showThresholds = true,
  interactive = true,
}) => {
  const [hoveredConclusion, setHoveredConclusion] = useState<string | null>(null);
  const { navigateToSource } = useUIStore();

  const chartData = useMemo(() => {
    const points: ChartDataPoint[] = data.map((d) => ({
      ...d,
      timeLabel: formatTime(d.timestamp),
    }));

    conclusions.forEach((conclusion) => {
      const idx = points.findIndex(
        (p) => Math.abs(p.timestamp - conclusion.timestamp) < 30000
      );
      if (idx >= 0) {
        points[idx] = {
          ...points[idx],
          isConclusion: true,
          conclusionLevel: conclusion.thresholdLevel,
          conclusionId: conclusion.id,
        };
      }
    });

    return points;
  }, [data, conclusions]);

  const yDomain = useMemo(() => {
    if (data.length === 0) return [0, 12];
    const maxPressure = Math.max(...data.map((d) => d.pressure));
    const minPressure = Math.min(...data.map((d) => d.pressure));
    return [Math.max(0, minPressure - 1), Math.min(12, maxPressure + 2)];
  }, [data]);

  const handleConclusionClick = (conclusion: AnalysisConclusion) => {
    if (!interactive) return;
    navigateToSource({
      sourceType: conclusion.sourceType,
      sourceId: conclusion.sourceId,
      sourceVersion: conclusion.sourceVersion || 1,
      sourceLine: conclusion.sourceLine || 0,
    });
  };

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ payload: ChartDataPoint; color: string; name: string; value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as ChartDataPoint;
      return (
        <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-3 shadow-industrial">
          <p className="text-industrial-text-muted text-xs mb-1">{label}</p>
          <p className="font-mono text-lg font-bold" style={{ color: getLevelColor(point.isConclusion ? point.conclusionLevel as 'normal' : getLevelForPressure(point.pressure)) }}>
            {point.pressure.toFixed(2)} MPa
          </p>
          {point.isConclusion && (
            <p className="text-xs mt-1 text-alert-orange">
              ⚠ 阈值跨档点 - {getLevelLabel(point.conclusionLevel as 'normal')}
            </p>
          )}
          {point.temperature && (
            <p className="text-xs text-industrial-text-muted mt-1">
              温度: {point.temperature.toFixed(1)}°C
            </p>
          )}
          {point.flowRate && (
            <p className="text-xs text-industrial-text-muted">
              流量: {point.flowRate.toFixed(1)} m³/h
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const getLevelForPressure = (pressure: number): 'normal' | 'warning' | 'danger' => {
    if (pressure >= 10) return 'danger';
    if (pressure >= 8) return 'warning';
    return 'normal';
  };

  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
        >
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#0a84ff" stopOpacity={0.8} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#3a3f4a" opacity={0.5} />

          {showThresholds && THRESHOLDS.map((threshold) => (
            <ReferenceLine
              key={threshold.level}
              y={threshold.max}
              stroke={threshold.color}
              strokeDasharray={threshold.level === 'normal' ? '0' : '5 5'}
              strokeWidth={threshold.level === 'normal' ? 1 : 2}
              opacity={0.7}
              label={{
                value: `${threshold.max}MPa`,
                position: 'right',
                fill: threshold.color,
                fontSize: 11,
              }}
            />
          ))}

          <XAxis
            dataKey="timeLabel"
            stroke="#5a6270"
            tick={{ fill: '#8b94a3', fontSize: 11 }}
            axisLine={{ stroke: '#3a3f4a' }}
            tickLine={{ stroke: '#3a3f4a' }}
            interval={Math.floor(chartData.length / 8)}
          />

          <YAxis
            domain={yDomain}
            stroke="#5a6270"
            tick={{ fill: '#8b94a3', fontSize: 11 }}
            axisLine={{ stroke: '#3a3f4a' }}
            tickLine={{ stroke: '#3a3f4a' }}
            label={{
              value: '压力 (MPa)',
              angle: -90,
              position: 'insideLeft',
              fill: '#8b94a3',
              fontSize: 12,
            }}
          />

          <ZAxis dataKey="pressure" range={[50, 50]} />

          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey="pressure"
            stroke="url(#lineGradient)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: '#0a84ff', stroke: '#fff', strokeWidth: 2 }}
            filter="url(#glow)"
            animationDuration={1000}
          />

          {interactive && conclusions.length > 0 && (
            <Scatter
              data={conclusions.map((c) => ({
                timestamp: c.timestamp,
                pressure: c.pressure,
                timeLabel: formatTime(c.timestamp),
                id: c.id,
                level: c.thresholdLevel,
              }))}
              dataKey="pressure"
              fill="#00d4aa"
              stroke="#fff"
              strokeWidth={2}
              shape={(props: { cx?: number; cy?: number; payload?: { id: string; level: string } }) => {
                const { cx, cy, payload } = props;
                if (!cx || !cy || !payload) return null;
                const isHovered = hoveredConclusion === payload.id;
                return (
                  <g
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredConclusion(payload.id)}
                    onMouseLeave={() => setHoveredConclusion(null)}
                    onClick={() => {
                      const conclusion = conclusions.find((c) => c.id === payload.id);
                      if (conclusion) handleConclusionClick(conclusion);
                    }}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 10 : 7}
                      fill={getLevelColor(payload.level as 'normal')}
                      stroke="#fff"
                      strokeWidth={2}
                      className={isHovered ? 'animate-pulse' : ''}
                      style={{
                        filter: `drop-shadow(0 0 8px ${getLevelColor(payload.level as 'normal')})`,
                      }}
                    />
                    {isHovered && (
                      <text
                        x={cx}
                        y={cy - 15}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize="11"
                        fontWeight="bold"
                      >
                        {getLevelLabel(payload.level as 'normal')}
                      </text>
                    )}
                  </g>
                );
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {conclusions.length > 0 && (
        <div className="absolute top-4 right-4 flex gap-2 text-xs">
          {THRESHOLDS.map((t) => (
            <div key={t.level} className="flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              <span className="text-industrial-text-muted">
                {getLevelLabel(t.level)}: {t.min}-{t.max}MPa
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
