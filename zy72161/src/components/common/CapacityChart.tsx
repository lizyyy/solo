import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

interface CapacityChartProps {
  capacityByTime: Record<string, number>;
  designCapacity: number;
}

const timeLabels: Record<string, string> = {
  morning: '早高峰',
  noon: '午间',
  afternoon: '下午',
  evening: '晚高峰',
  night: '夜间'
};

export const CapacityChart: React.FC<CapacityChartProps> = ({ capacityByTime, designCapacity }) => {
  const data = Object.entries(capacityByTime).map(([key, value]) => ({
    name: timeLabels[key] || key,
    count: value,
    isOver: value > designCapacity * 0.9
  }));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#4B5563' }} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#4B5563' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F3F4F6'
            }}
            formatter={(value: number) => [`${value}人`, '人数']}
          />
          <ReferenceLine
            y={designCapacity}
            stroke="#F97316"
            strokeDasharray="5 5"
            label={{
              value: `设计容量 ${designCapacity}`,
              fill: '#F97316',
              fontSize: 11,
              position: 'right'
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} name="人数">
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isOver ? '#DC2626' : '#3B82F6'}
                fillOpacity={entry.isOver ? 0.8 : 0.6}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
