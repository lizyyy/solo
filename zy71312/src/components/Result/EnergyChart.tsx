import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import { useSolarStore } from '../../store/useSolarStore';

export const EnergyChart: React.FC = () => {
  const { results } = useSolarStore();
  const [chartType, setChartType] = useState<'monthly' | 'hourly'>('monthly');

  const monthlyData = results.monthlyEnergy.map((value, index) => ({
    name: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'][index],
    发电量: value,
  }));

  const hourlyData = results.hourlyEnergy.map((value, index) => ({
    name: `${index}时`,
    发电量: value,
  })).filter((_, i) => i >= 5 && i <= 20);

  const data = chartType === 'monthly' ? monthlyData : hourlyData;
  const maxValue = Math.max(...data.map((d) => d.发电量), 1);

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">发电量趋势</h3>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setChartType('monthly')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              chartType === 'monthly'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            月度
          </button>
          <button
            onClick={() => setChartType('hourly')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              chartType === 'hourly'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            日度
          </button>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value: number) => [`${value} kWh`, '发电量']}
            />
            <Bar
              dataKey="发电量"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-1 text-gray-600">
          <TrendingUp className="w-4 h-4" />
          <span>
            年总发电量: <span className="font-bold text-blue-600">{results.annualEnergy.toLocaleString()} kWh</span>
          </span>
        </div>
        <div className="text-gray-500 text-xs">
          日均: {Math.round(results.annualEnergy / 365)} kWh
        </div>
      </div>
    </div>
  );
};
