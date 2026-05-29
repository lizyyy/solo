import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useStore } from '@/store/useStore';
import { STATUS_LABELS, type ApplicationStatus } from '@/types';

const COLORS: Record<string, string> = {
  pending: '#adb5bd',
  confirmed: '#2d7dd2',
  exercised: '#27ae60',
  withdrawn: '#e74c3c',
};

export default function StatusBarChart() {
  const { getStatusStats, setFilterConditions } = useStore();
  const stats = getStatusStats();

  const data = Object.entries(stats).map(([key, value]) => ({
    name: STATUS_LABELS[key as ApplicationStatus],
    value,
    status: key,
  }));

  const handleClick = (entry: { status: string }) => {
    setFilterConditions({ applicationStatus: [entry.status as ApplicationStatus] });
  };

  return (
    <div className="card p-4 h-full">
      <h4 className="text-sm font-medium text-neutral-700 mb-3">状态分布</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#868e96' }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#495057' }}
            width={60}
          />
          <Tooltip
            formatter={(value: number) => [`${value} 条`, '数量']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
