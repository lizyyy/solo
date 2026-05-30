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
} from 'recharts';
import type { SpectrumPoint } from '@/types';

interface SpectrumChartProps {
  spectrum: SpectrumPoint[];
  dominantWavelength: number;
}

const wavelengthToColor = (wavelength: number): string => {
  let r = 0, g = 0, b = 0;

  if (wavelength >= 380 && wavelength < 440) {
    r = -(wavelength - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (wavelength >= 440 && wavelength < 490) {
    r = 0;
    g = (wavelength - 440) / (490 - 440);
    b = 1;
  } else if (wavelength >= 490 && wavelength < 510) {
    r = 0;
    g = 1;
    b = -(wavelength - 510) / (510 - 490);
  } else if (wavelength >= 510 && wavelength < 580) {
    r = (wavelength - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (wavelength >= 580 && wavelength < 645) {
    r = 1;
    g = -(wavelength - 645) / (645 - 580);
    b = 0;
  } else if (wavelength >= 645 && wavelength <= 780) {
    r = 1;
    g = 0;
    b = 0;
  }

  let factor = 1;
  if (wavelength >= 380 && wavelength < 420) {
    factor = 0.3 + (0.7 * (wavelength - 380)) / (420 - 380);
  } else if (wavelength >= 645 && wavelength <= 780) {
    factor = 0.3 + (0.7 * (780 - wavelength)) / (780 - 645);
  }

  const toHex = (c: number): string => {
    const hex = Math.round(Math.max(0, Math.min(1, c * factor)) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const SpectrumChart = ({ spectrum, dominantWavelength }: SpectrumChartProps) => {
  const chartData = useMemo(() => {
    return spectrum.map((point) => ({
      ...point,
      color: wavelengthToColor(point.wavelength),
      reflectancePercent: (point.reflectance * 100).toFixed(1),
    }));
  }, [spectrum]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800/95 border border-slate-600 rounded-lg p-3 shadow-xl">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-4 h-4 rounded border border-slate-500"
              style={{ backgroundColor: data.color }}
            />
            <span className="text-sm font-medium text-white">{data.wavelength} nm</span>
          </div>
          <p className="text-xs text-gray-300">
            反射率: <span className="text-cyan-400 font-mono">{data.reflectancePercent}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spectrumGradient" x1="0" y1="0" x2="1" y2="0">
              {chartData.map((point, idx) => (
                <stop
                  key={idx}
                  offset={`${(idx / (chartData.length - 1)) * 100}%`}
                  stopColor={point.color}
                />
              ))}
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis
            dataKey="wavelength"
            stroke="#94a3b8"
            fontSize={11}
            tickFormatter={(v) => `${v}`}
            label={{
              value: '波长 (nm)',
              position: 'insideBottom',
              offset: -5,
              fill: '#94a3b8',
              fontSize: 11,
            }}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            domain={[0, 'auto']}
            label={{
              value: '反射率',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              fill: '#94a3b8',
              fontSize: 11,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {dominantWavelength > 0 && (
            <ReferenceLine
              x={dominantWavelength}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: `主波长: ${dominantWavelength}nm`,
                position: 'top',
                fill: '#f59e0b',
                fontSize: 10,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="reflectance"
            stroke="url(#spectrumGradient)"
            strokeWidth={2}
            fill="url(#spectrumGradient)"
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
