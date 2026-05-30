import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface HitTrendData {
  date: string;
  hits: number;
  drills: number;
}

interface HitTrendChartProps {
  data: HitTrendData[];
}

export default function HitTrendChart({ data }: HitTrendChartProps) {
  const displayData = data.slice(-7);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-100 border border-dark-200 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-white mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={displayData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            stroke="#64748B"
            tick={{ fill: '#94A3B8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            yAxisId="left"
            stroke="#DC2626"
            tick={{ fill: '#94A3B8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            label={{ value: '命中数', angle: -90, position: 'insideLeft', fill: '#DC2626', fontSize: 12 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#3B82F6"
            tick={{ fill: '#94A3B8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            label={{ value: '演练次数', angle: 90, position: 'insideRight', fill: '#3B82F6', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: '#94A3B8', fontSize: 12 }}
            iconType="circle"
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="hits"
            name="命中数"
            stroke="#DC2626"
            fill="url(#colorHits)"
            strokeWidth={2}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="drills"
            name="演练次数"
            stroke="#3B82F6"
            fill="none"
            strokeWidth={2}
          />
          <defs>
            <linearGradient id="colorHits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#DC2626" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#DC2626" stopOpacity={0.1} />
            </linearGradient>
          </defs>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
