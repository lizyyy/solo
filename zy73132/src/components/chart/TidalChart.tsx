import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  Cell,
} from 'recharts';
import useAppStore from '../../store/useAppStore';
import { formatTime, convertToMeters, getAnomalyTypeLabel } from '../../utils/helpers';
import type { TidalRecord } from '../../types';

const TidalChart: React.FC = () => {
  const {
    getCurrentStationRecords,
    currentTimeIndex,
    selectedRecordId,
    setSelectedRecord,
    isPlaying,
  } = useAppStore();

  const rawRecords = getCurrentStationRecords();

  const chartData = useMemo(() => {
    return rawRecords.map(r => ({
      ...r,
      displayLevel: convertToMeters(r.waterLevel, r.unit),
      displayTime: formatTime(r.timestamp),
      isCurrent: false,
    }));
  }, [rawRecords]);

  if (chartData[currentTimeIndex]) {
    chartData[currentTimeIndex].isCurrent = true;
  }

  const anomalyPoints = chartData.filter(r => r.isAnomaly);

  const getAnomalyColor = (type: string) => {
    switch (type) {
      case 'outlier': return '#FF6B6B';
      case 'unit_mismatch': return '#FFB627';
      case 'bottle_mismatch': return '#a78bfa';
      case 'manual_change': return '#f472b6';
      default: return '#FF6B6B';
    }
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: TidalRecord & { displayLevel: number; displayTime: string } }> }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="glass-panel rounded-lg p-3 border border-ocean-400/30 shadow-xl min-w-[200px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-ocean-400 font-medium">{data.displayTime}</span>
            {data.isAnomaly && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${getAnomalyColor(data.anomalyType)}30`, color: getAnomalyColor(data.anomalyType) }}
              >
                ⚠ {getAnomalyTypeLabel(data.anomalyType)}
              </span>
            )}
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">潮位 (换算):</span>
              <span className="font-mono text-ocean-300">{data.displayLevel.toFixed(3)} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">原始值:</span>
              <span className="font-mono text-slate-300">{data.waterLevel} {data.unit}</span>
            </div>
            {data.originalUnit !== data.unit && (
              <div className="flex justify-between text-anomaly-400">
                <span>原始单位:</span>
                <span className="font-mono">{data.originalUnit} ⚠</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">采样瓶:</span>
              <span className="font-mono text-slate-300">
                {data.bottleId}
                {data.bottleVersion === 'old' && <span className="text-amber-400 ml-1">(旧)</span>}
              </span>
            </div>
            {data.anomalyReason && (
              <div className="pt-1 mt-1 border-t border-ocean-400/20 text-anomaly-300">
                {data.anomalyReason}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const handleClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      setSelectedRecord(data.activePayload[0].payload.id);
    }
  };

  const currentRecord = chartData[currentTimeIndex];

  return (
    <div className="h-full glass-panel rounded-xl overflow-hidden flex flex-col relative">
      <div className="px-4 py-3 border-b border-ocean-400/15 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ocean-300">
          潮位时序曲线
          {isPlaying && <span className="ml-2 text-xs text-anomaly-400 animate-pulse">● 回放中</span>}
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-ocean-400 rounded" />
            <span className="text-slate-400">潮位 (m)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-anomaly-500 animate-pulse" />
            <span className="text-slate-400">异常点</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 relative">
        {isPlaying && (
          <div className="absolute inset-0 pointer-events-none scan-line-effect overflow-hidden" />
        )}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            onClick={handleClick}
          >
            <defs>
              <linearGradient id="tidalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#00D4FF" strokeOpacity={0.08} />
            <XAxis
              dataKey="displayTime"
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={{ stroke: '#00D4FF', strokeOpacity: 0.2 }}
              axisLine={{ stroke: '#00D4FF', strokeOpacity: 0.2 }}
              interval={Math.floor(chartData.length / 8)}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={{ stroke: '#00D4FF', strokeOpacity: 0.2 }}
              axisLine={{ stroke: '#00D4FF', strokeOpacity: 0.2 }}
              domain={['auto', 'auto']}
              tickFormatter={(v) => `${v.toFixed(1)}`}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#00D4FF', strokeOpacity: 0.4, strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey="displayLevel"
              stroke="#00D4FF"
              strokeWidth={2}
              fill="url(#tidalGradient)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const isSelected = payload.id === selectedRecordId;
                if (isSelected) {
                  return (
                    <circle cx={cx} cy={cy} r={7} fill="none" stroke="#00D4FF" strokeWidth={2} strokeOpacity={0.6}>
                      <animate attributeName="r" values="5;10;5" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  );
                }
                return null;
              }}
            />
            {currentRecord && (
              <ReferenceLine
                x={currentRecord.displayTime}
                stroke="#FFB627"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                strokeOpacity={0.7}
              />
            )}
            <Scatter dataKey="displayLevel">
              {anomalyPoints.map((entry, index) => (
                <Cell
                  key={`anomaly-${index}`}
                  fill={getAnomalyColor(entry.anomalyType)}
                  stroke={getAnomalyColor(entry.anomalyType)}
                  strokeWidth={2}
                />
              ))}
            </Scatter>
            {anomalyPoints.map((entry, i) => {
              const index = chartData.findIndex(d => d.id === entry.id);
              if (index === -1) return null;
              return (
                <circle key={`pulse-${i}`} r={4} fill="none">
                  <animate attributeName="r" values="3;10;3" dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
                  <animate attributeName="fill-opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
                </circle>
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {currentRecord && (
        <div className="px-4 py-2.5 border-t border-ocean-400/15 flex items-center justify-between text-xs bg-deep-sea-900/50">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              当前: <span className="font-mono text-ocean-400">{currentRecord.displayTime}</span>
            </span>
            <span className="text-slate-400">
              潮位: <span className="font-mono text-ocean-300">{currentRecord.displayLevel.toFixed(3)} m</span>
            </span>
            {currentRecord.isAnomaly && (
              <span
                className="px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: `${getAnomalyColor(currentRecord.anomalyType)}25`, color: getAnomalyColor(currentRecord.anomalyType) }}
              >
                {getAnomalyTypeLabel(currentRecord.anomalyType)}
              </span>
            )}
          </div>
          <span className="text-slate-500 font-mono">
            {currentTimeIndex + 1} / {chartData.length}
          </span>
        </div>
      )}
    </div>
  );
};

export default TidalChart;
