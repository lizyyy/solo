import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CurvePoint } from '@/types';

interface CurveChartProps {
  data: CurvePoint[];
  title?: string;
}

const metricColors: Record<string, string> = {
  ctr_loss: '#3b82f6',
  cvr_loss: '#10b981',
  total_loss: '#6366f1',
  auc_score: '#f59e0b',
};

export const CurveChart = ({ data, title }: CurveChartProps) => {
  const metrics = [...new Set(data.map((d) => d.metric))];

  const chartData = data.reduce((acc: Record<string, any>[], point) => {
    const existing = acc.find((d) => d.epoch === point.epoch);
    if (existing) {
      existing[point.metric] = point.value;
    } else {
      acc.push({ epoch: point.epoch, [point.metric]: point.value });
    }
    return acc;
  }, []);

  chartData.sort((a, b) => a.epoch - b.epoch);

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      {title && (
        <h3
          className="text-lg font-semibold text-gray-900 mb-4"
          style={{ fontFamily: "'Source Serif Pro', serif" }}
        >
          {title}
        </h3>
      )}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="epoch" stroke="#6b7280" fontSize={12} label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Legend />
            {metrics.map((metric) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={metricColors[metric] || '#6b7280'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
