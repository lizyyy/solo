import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { PieChartData } from '@shared/types';
import { useNavigate } from 'react-router-dom';
import { useClearingStore } from '@/store/useClearingStore';
import { STATUS_LABELS } from '@shared/types';

interface StatusPieChartProps {
  data: PieChartData[];
}

const RADIAN = Math.PI / 180;

interface CustomLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  name: string;
  value: number;
  percent: number;
}

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, value, percent }: CustomLabelProps) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="500">
      {value}
    </text>
  );
};

export default function StatusPieChart({ data }: StatusPieChartProps) {
  const navigate = useNavigate();
  const { adjustments, navigateToAdjustmentOrCustody } = useClearingStore();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleClick = (entry: PieChartData, index: number) => {
    setActiveIndex(index);
    const filtered = adjustments.filter((a) => {
      if (entry.status === 'normal') {
        return !a.hasZeroAmountButReversed;
      }
      return a.status === entry.status;
    });

    if (filtered.length > 0) {
      navigateToAdjustmentOrCustody(filtered[0].id, navigate);
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center text-carbon-400">
        暂无图表数据
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={100}
            innerRadius={40}
            paddingAngle={2}
            dataKey="value"
            onClick={(entry, index) => handleClick(entry, index)}
            style={{ cursor: 'pointer' }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                stroke={activeIndex === index ? '#1a1f2e' : 'white'}
                strokeWidth={activeIndex === index ? 2 : 1}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value} 条`, name]}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e6e9f2',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
          />
          <Legend
            formatter={(value, entry: any) => (
              <span className="text-sm text-carbon-600 cursor-pointer hover:text-carbon-800">
                {entry.payload.name} ({entry.payload.value})
              </span>
            )}
            onClick={(entry: any) => {
              const index = data.findIndex((d) => d.name === entry.payload.name);
              if (index >= 0) {
                handleClick(data[index], index);
              }
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-center text-xs text-carbon-400 mt-2">
        点击扇区可跳转至对应记录
      </p>
    </div>
  );
}
