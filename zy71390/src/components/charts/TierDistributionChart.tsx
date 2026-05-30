import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Tier, TIER_LABELS } from '../../../shared/types';

interface TierDistributionData {
  tier: Tier;
  count: number;
  hitCount: number;
}

interface TierDistributionChartProps {
  data: TierDistributionData[];
}

export default function TierDistributionChart({ data }: TierDistributionChartProps) {
  const chartData = data.map(item => ({
    ...item,
    tierLabel: TIER_LABELS[item.tier]
  }));

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
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="tierLabel"
            stroke="#64748B"
            tick={{ fill: '#94A3B8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            stroke="#64748B"
            tick={{ fill: '#94A3B8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: '#94A3B8', fontSize: 12 }}
            iconType="circle"
          />
          <Bar
            dataKey="count"
            name="客户总数"
            fill="#3B82F6"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="hitCount"
            name="命中数"
            fill="#DC2626"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
