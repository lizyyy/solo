import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { PressurePoint } from '../../types';

interface PressureChartProps {
  data: PressurePoint[];
  minPressure: number;
}

export function PressureChart({ data, minPressure }: PressureChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-400">
        暂无数据
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    distanceLabel: `${point.distance}m`,
  }));

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="distanceLabel"
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            domain={[0, 'auto']}
            tickFormatter={(value) => `${value.toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#fff',
            }}
            formatter={(value: number) => [`${value.toFixed(3)} MPa`, '压力']}
            labelFormatter={(label) => `距离: ${label}`}
          />
          <ReferenceLine
            y={minPressure}
            stroke="#ef4444"
            strokeDasharray="5 5"
            label={{
              value: `最低 ${minPressure}MPa`,
              fill: '#ef4444',
              fontSize: 10,
              position: 'right',
            }}
          />
          <Line
            type="monotone"
            dataKey="pressure"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#60a5fa' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
