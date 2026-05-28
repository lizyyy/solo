import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { CalculationPoint } from '../types/auction';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface RevenueChartProps {
  data: {
    conservative: CalculationPoint[];
    neutral: CalculationPoint[];
    optimistic: CalculationPoint[];
  };
  optimalReservePrice?: number;
}

const scenarioColors: Record<string, string> = {
  conservative: '#dc2626',
  neutral: '#1e3a5f',
  optimistic: '#059669',
};

export const RevenueChart: React.FC<RevenueChartProps> = ({ data, optimalReservePrice }) => {
  const combinedData = data.neutral.map((neutral, index) => ({
    reservePrice: neutral.reservePrice,
    reserveRatio: neutral.reserveRatio,
    conservative: data.conservative[index]?.expectedRevenue ?? 0,
    neutral: neutral.expectedRevenue,
    optimistic: data.optimistic[index]?.expectedRevenue ?? 0,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-md shadow-lg p-3">
          <p className="text-sm font-medium text-slate-700 border-b pb-1 mb-2">
            保留价: {formatCurrency(label as number)}
          </p>
          <p className="text-xs text-slate-500 mb-2">
            占估值: {formatPercent(combinedData.find(d => d.reservePrice === label)?.reserveRatio || 0)}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'conservative' ? '保守' : entry.name === 'neutral' ? '中性' : '乐观'}:
              {' '}{formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={combinedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="reservePrice"
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            stroke="#94a3b8"
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            stroke="#94a3b8"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => {
              if (value === 'conservative') return '保守情景';
              if (value === 'neutral') return '中性情景';
              if (value === 'optimistic') return '乐观情景';
              return value;
            }}
          />
          {optimalReservePrice && (
            <ReferenceLine
              x={optimalReservePrice}
              stroke="#d4af37"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: `最优保留价 ${formatCurrency(optimalReservePrice)}`,
                fill: '#b45309',
                fontSize: 12,
                fontWeight: 600,
                position: 'top',
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="conservative"
            stroke={scenarioColors.conservative}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="neutral"
            stroke={scenarioColors.neutral}
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="optimistic"
            stroke={scenarioColors.optimistic}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
