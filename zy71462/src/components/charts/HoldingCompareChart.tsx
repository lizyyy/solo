import React, { useMemo } from 'react';
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
} from 'recharts';
import { Holding, TargetWeight, TradeSuggestion } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface HoldingCompareChartProps {
  holdings: Holding[];
  targetWeights: TargetWeight[];
  trades: TradeSuggestion[];
}

export const HoldingCompareChart: React.FC<HoldingCompareChartProps> = ({
  holdings,
  targetWeights,
  trades,
}) => {
  const data = useMemo(() => {
    const targetWeightMap = new Map(targetWeights.map(t => [t.symbol, t.targetWeight]));
    const tradeMap = new Map(trades.map(t => [t.symbol, t]));

    return holdings
      .slice()
      .sort((a, b) => b.marketValue - a.marketValue)
      .map(h => {
        const targetWeight = targetWeightMap.get(h.symbol) || 0;
        const trade = tradeMap.get(h.symbol);
        const suggestedWeight = trade?.suggestedWeight || h.currentWeight;
        
        return {
          name: h.symbol,
          fullName: h.name,
          当前权重: Math.round(h.currentWeight * 10000) / 100,
          目标权重: Math.round(targetWeight * 10000) / 100,
          建议权重: Math.round(suggestedWeight * 10000) / 100,
        };
      });
  }, [holdings, targetWeights, trades]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = data.find(d => d.name === label);
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm font-medium text-slate-100 mb-1">
            {label} {item?.fullName ? `(${item.fullName})` : ''}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">权重对比分析</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 'auto']}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                iconType="rect"
              />
              <Bar
                dataKey="当前权重"
                fill="#3b82f6"
                radius={[0, 2, 2, 0]}
                barSize={14}
              />
              <Bar
                dataKey="目标权重"
                fill="#10b981"
                radius={[0, 2, 2, 0]}
                barSize={14}
              />
              <Bar
                dataKey="建议权重"
                fill="#f59e0b"
                radius={[0, 2, 2, 0]}
                barSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
