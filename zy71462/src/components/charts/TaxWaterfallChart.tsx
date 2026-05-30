import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Task, TradeSuggestion } from '@/types';

interface TaxWaterfallChartProps {
  task: Task | null;
  trades: TradeSuggestion[];
}

export const TaxWaterfallChart: React.FC<TaxWaterfallChartProps> = ({
  task,
  trades,
}) => {
  const data = useMemo(() => {
    if (!task) return [];

    const totalCommission = trades.reduce((sum, t) => sum + t.estimatedCommission, 0);
    const totalStampDuty = trades.reduce((sum, t) => sum + t.estimatedStampDuty, 0);
    const totalCGT = trades.reduce((sum, t) => sum + t.estimatedCapitalGainsTax, 0);
    const totalOffset = trades.reduce((sum, t) => sum + t.lossOffsetApplied, 0);

    const totalGains = trades
      .filter(t => t.action === 'sell')
      .reduce((sum, t) => {
        const gain = (t.price - (t.estimatedValue / t.quantity)) * t.quantity;
        return sum + Math.max(0, gain);
      }, 0);

    return [
      {
        name: '实现盈利',
        value: totalGains,
        type: 'base',
      },
      {
        name: '交易佣金',
        value: -totalCommission,
        type: 'cost',
      },
      {
        name: '印花税',
        value: -totalStampDuty,
        type: 'cost',
      },
      {
        name: '资本利得税',
        value: -totalCGT,
        type: 'tax',
      },
      {
        name: '亏损抵扣',
        value: totalOffset,
        type: 'benefit',
      },
      {
        name: '税后净收益',
        value: totalGains - totalCommission - totalStampDuty - totalCGT + totalOffset,
        type: 'result',
      },
    ];
  }, [task, trades]);

  const colors = {
    base: '#3b82f6',
    cost: '#f43f5e',
    tax: '#ef4444',
    benefit: '#10b981',
    result: '#8b5cf6',
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm font-medium text-slate-100 mb-1">{label}</p>
          <p className="text-xs text-slate-300">
            金额: <span className={value >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {value >= 0 ? '+' : ''}{value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}元
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (!task) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base">税费瀑布图</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 flex items-center justify-center text-slate-500">
            请先运行再平衡计算
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">税费构成分析</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#475569' }}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`}
                axisLine={{ stroke: '#475569' }}
              />
              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[entry.type as keyof typeof colors]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-slate-900/50 rounded-md p-3">
            <div className="text-xs text-slate-500 mb-1">总税费</div>
            <div className="text-lg font-semibold text-rose-400 font-mono">
              {task.totalTax.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}元
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-md p-3">
            <div className="text-xs text-slate-500 mb-1">亏损抵扣</div>
            <div className="text-lg font-semibold text-emerald-400 font-mono">
              {task.totalLossOffset.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}元
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-md p-3">
            <div className="text-xs text-slate-500 mb-1">税后收益</div>
            <div className="text-lg font-semibold text-blue-400 font-mono">
              {task.afterTaxReturn.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}元
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-md p-3">
            <div className="text-xs text-slate-500 mb-1">跟踪误差</div>
            <div className="text-lg font-semibold text-amber-400 font-mono">
              {(task.trackingError * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
