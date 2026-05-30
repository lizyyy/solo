import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from 'recharts';
import type { FrequencySample, BandType } from '@/types';
import { BAND_CONFIGS } from '@/types';

interface FrequencyChartProps {
  samples: FrequencySample[];
  currentBand: BandType;
}

export function FrequencyChart({ samples, currentBand }: FrequencyChartProps) {
  const chartData = useMemo(() => {
    const sorted = [...samples].sort((a, b) => a.frequency - b.frequency);
    return sorted.map((sample) => ({
      frequency: sample.frequency,
      response: sample.responseIntensity,
      band: sample.band,
      position: `(${sample.position.x.toFixed(2)}, ${sample.position.y.toFixed(2)}, ${sample.position.z.toFixed(2)})`,
    }));
  }, [samples]);

  const bandConfig = useMemo(() => {
    return BAND_CONFIGS.find((b) => b.key === currentBand)!;
  }, [currentBand]);

  const bandRanges = useMemo(() => {
    return BAND_CONFIGS.map((config) => ({
      ...config,
      fill: config.key === currentBand ? config.color + '30' : config.color + '10',
    }));
  }, [currentBand]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const band = BAND_CONFIGS.find((b) => b.key === data.band);
      return (
        <div className="bg-charcoal-900 border border-charcoal-700 rounded-lg p-3 shadow-xl">
          <p className="font-mono text-sm text-bronze-400">
            {data.frequency.toFixed(0)} Hz
          </p>
          <p className="font-mono text-sm text-gray-300">
            响应强度：{data.response.toFixed(1)} dB
          </p>
          <p className="font-mono text-xs" style={{ color: band?.color }}>
            频段：{band?.label}
          </p>
          <p className="font-mono text-xs text-gray-500">
            位置：{data.position}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card-panel h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg text-bronze-400">频率响应曲线</h3>
        <div className="flex items-center gap-2">
          {BAND_CONFIGS.map((band) => (
            <div key={band.key} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: band.color }}
              />
              <span className="text-xs text-gray-500 font-mono">{band.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorResponse" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={bandConfig.color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={bandConfig.color} stopOpacity={0.1} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />

            {bandRanges.map((band) => (
              <ReferenceLine
                key={`start-${band.key}`}
                x={band.minFreq}
                stroke={band.color}
                strokeOpacity={band.key === currentBand ? 0.6 : 0.2}
                strokeDasharray="5 5"
                label={{
                  value: `${band.minFreq}Hz`,
                  position: 'top',
                  fill: band.key === currentBand ? band.color : '#555',
                  fontSize: 10,
                }}
              />
            ))}
            <ReferenceLine
              x={8000}
              stroke={BAND_CONFIGS[2].color}
              strokeOpacity={currentBand === 'high' ? 0.6 : 0.2}
              strokeDasharray="5 5"
              label={{
                value: '8000Hz',
                position: 'top',
                fill: currentBand === 'high' ? BAND_CONFIGS[2].color : '#555',
                fontSize: 10,
              }}
            />

            <XAxis
              dataKey="frequency"
              stroke="#555"
              tick={{ fill: '#888', fontSize: 11, fontFamily: 'monospace' }}
              scale="log"
              domain={[80, 8000]}
              type="number"
            />
            <YAxis
              stroke="#555"
              tick={{ fill: '#888', fontSize: 11, fontFamily: 'monospace' }}
              domain={[40, 100]}
              label={{
                value: 'dB',
                angle: -90,
                position: 'insideLeft',
                fill: '#888',
                fontSize: 12,
                fontFamily: 'monospace',
              }}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="response"
              stroke={bandConfig.color}
              strokeWidth={2}
              fill="url(#colorResponse)"
              dot={{
                fill: bandConfig.color,
                r: 4,
                strokeWidth: 2,
                stroke: '#121212',
              }}
              activeDot={{
                r: 6,
                fill: bandConfig.color,
                stroke: '#fff',
                strokeWidth: 2,
              }}
            />

            <Brush
              dataKey="frequency"
              height={20}
              stroke={bandConfig.color}
              fill="#1a1a1a"
              startIndex={0}
              endIndex={chartData.length - 1}
              tickFormatter={(value) => `${value.toFixed(0)}Hz`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3 border-t border-charcoal-700">
        <div className="grid grid-cols-3 gap-2 text-center">
          {BAND_CONFIGS.map((band) => {
            const bandSamples = samples.filter((s) => s.band === band.key);
            const avgResponse = bandSamples.length > 0
              ? bandSamples.reduce((sum, s) => sum + s.responseIntensity, 0) / bandSamples.length
              : 0;

            return (
              <div
                key={band.key}
                className={`p-2 rounded-lg ${
                  band.key === currentBand
                    ? 'bg-charcoal-800 border border-charcoal-600'
                    : 'bg-charcoal-900/50'
                }`}
              >
                <p className="text-xs text-gray-500 font-mono">{band.label}平均</p>
                <p
                  className="text-lg font-serif font-semibold"
                  style={{ color: band.color }}
                >
                  {avgResponse.toFixed(1)} dB
                </p>
                <p className="text-xs text-gray-600 font-mono">
                  {bandSamples.length} 采样点
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
