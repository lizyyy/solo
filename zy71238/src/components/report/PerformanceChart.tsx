import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface PerformanceChartProps {
  netValueHistory: number[];
  indexValueHistory: number[];
  trackingErrorHistory: number[];
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  netValueHistory,
  indexValueHistory,
  trackingErrorHistory,
}) => {
  const chartData = netValueHistory.map((nav, i) => ({
    round: i + 1,
    portfolio: nav / 1000000,
    index: indexValueHistory[i] || 0,
    trackingError: (trackingErrorHistory[i] || 0) * 100,
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">📈 净值对比</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0F172A" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0F172A" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorIndex" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="round" label={{ value: '回合', position: 'bottom', offset: -5 }} />
            <YAxis />
            <Tooltip 
              formatter={(value: number, name: string) => [
                value.toFixed(2) + (name === 'trackingError' ? '%' : ''),
                name === 'portfolio' ? '组合净值(万)' : name === 'index' ? '指数点位' : '跟踪误差'
              ]}
            />
            <Legend formatter={(value) => value === 'portfolio' ? '组合净值(万)' : value === 'index' ? '指数点位' : value} />
            <Area
              type="monotone"
              dataKey="portfolio"
              stroke="#0F172A"
              strokeWidth={2}
              fill="url(#colorPortfolio)"
              name="portfolio"
            />
            <Area
              type="monotone"
              dataKey="index"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#colorIndex)"
              name="index"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">📉 跟踪误差趋势</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="round" label={{ value: '回合', position: 'bottom', offset: -5 }} />
            <YAxis unit="%" />
            <Tooltip formatter={(value: number) => [value.toFixed(4) + '%', '跟踪误差']} />
            <Line
              type="monotone"
              dataKey="trackingError"
              stroke="#EF4444"
              strokeWidth={2}
              dot={{ fill: '#EF4444', r: 4 }}
              name="跟踪误差"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
