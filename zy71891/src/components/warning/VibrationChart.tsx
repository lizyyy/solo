import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { VibrationData } from '../../types';

interface VibrationChartProps {
  data: VibrationData[];
  threshold?: number;
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: VibrationData & { time: string };
}

export default function VibrationChart({ data, threshold = 8.0 }: VibrationChartProps) {
  const chartData = data.map(d => ({
    ...d,
    time: new Date(d.timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));

  const CustomDot = ({ cx, cy, payload }: CustomDotProps) => {
    if (!payload) return null;

    if (payload.isManuallyModified) {
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill="#FF7D00"
            stroke="#fff"
            strokeWidth={2}
          />
          <circle
            cx={cx}
            cy={cy}
            r={2}
            fill="#fff"
          />
        </g>
      );
    }

    if (payload.value > threshold) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={4}
          fill="#F53F3F"
          stroke="#fff"
          strokeWidth={1}
        />
      );
    }

    return null;
  };

  return (
    <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-medium">振动曲线</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            橙色标记为手工改动数据点，红色标记为超阈值
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FF7D00]" />
            <span className="text-gray-400">手工改动</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#F53F3F]" />
            <span className="text-gray-400">超阈值</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-[#FF7D00] border-t border-dashed" />
            <span className="text-gray-400">安全阈值 {threshold} mm/s</span>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
            <XAxis
              dataKey="time"
              stroke="#4a5568"
              tick={{ fill: '#718096', fontSize: 11 }}
              tickLine={{ stroke: '#4a5568' }}
            />
            <YAxis
              stroke="#4a5568"
              tick={{ fill: '#718096', fontSize: 11 }}
              tickLine={{ stroke: '#4a5568' }}
              domain={[0, 'auto']}
              label={{
                value: '振动值 (mm/s)',
                angle: -90,
                position: 'insideLeft',
                fill: '#718096',
                fontSize: 11,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1f2e',
                border: '1px solid #2d3748',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value: number) => [`${value.toFixed(2)} mm/s`, '振动值']}
              labelFormatter={(label) => `时间: ${label}`}
            />
            <ReferenceLine
              y={threshold}
              stroke="#FF7D00"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: `阈值 ${threshold}`,
                fill: '#FF7D00',
                fontSize: 10,
                position: 'right',
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#165DFF"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#165DFF' }}
              animationDuration={1000}
              animationBegin={200}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
