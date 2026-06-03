import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import type { ReportResult } from '../../shared/types';
import { RECORD_TYPE_LABELS } from '../../shared/types';

interface ComparisonChartProps {
  results: ReportResult[];
  height?: number;
}

const COLORS = {
  success: '#10b981',
  blocked: '#f59e0b',
  legacy: '#3b82f6',
};

export const ComparisonChart: React.FC<ComparisonChartProps> = ({ results, height = 350 }) => {
  const chartData = results.map((result, index) => ({
    name: `${RECORD_TYPE_LABELS[result.recordType]}`,
    recordId: result.recordId,
    '实测距离': result.safetyDistance,
    '要求距离': result.requiredDistance,
    '差值': result.safetyDistance - result.requiredDistance,
    type: result.recordType,
    compliant: result.compliance,
    index,
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          barGap={8}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" />
          <XAxis 
            dataKey="name" 
            tick={{ fill: '#486581', fontSize: 12, fontFamily: 'Noto Sans SC' }}
          />
          <YAxis 
            label={{ value: '米', angle: -90, position: 'insideLeft', fill: '#627d98' }}
            tick={{ fill: '#627d98', fontSize: 11 }}
            tickFormatter={(value) => `${value}m`}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === '差值') {
                return [`${value > 0 ? '+' : ''}${value} 米`, name];
              }
              return [`${value} 米`, name];
            }}
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #bcccdc',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px', fontFamily: 'Noto Sans SC' }}
          />
          <ReferenceLine 
            y={0} 
            stroke="#9fb3c8" 
            strokeDasharray="3 3"
          />
          <Bar dataKey="实测距离" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.type]} />
            ))}
          </Bar>
          <Bar 
            dataKey="要求距离" 
            fill="#9fb3c8" 
            radius={[4, 4, 0, 0]}
            opacity={0.7}
          />
          <Bar 
            dataKey="差值" 
            fill="#1e3a5f" 
            radius={[4, 4, 0, 0]}
            opacity={0.5}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
