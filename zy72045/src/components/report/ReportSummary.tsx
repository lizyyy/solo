import { TrendingUp, TrendingDown, Target, BarChart3, Calendar, Award } from 'lucide-react';
import { NumberScroll } from '../common/NumberScroll';
import type { HistoryRecord } from '../../types/history';
import { formatCurrency, formatPercent, getReturnColor } from '../../utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ReportSummaryProps {
  record: HistoryRecord;
}

export function ReportSummary({ record }: ReportSummaryProps) {
  const { settlement, initialCapital, finalCapital, totalReturn, totalReturnPercent } = record;

  const chartData = record.rounds.map((round, index) => ({
    name: `第${round.roundNumber}回合`,
    收益率: ((round.capital - initialCapital) / initialCapital) * 100,
    资产: round.capital,
  }));

  if (record.rounds.length > 0) {
    chartData.push({
      name: '结算',
      收益率: totalReturnPercent * 100,
      资产: finalCapital,
    });
  }

  const settleReasonMap: Record<string, string> = {
    round_end: '回合结束自动结算',
    manual: '手动结算',
    stop_loss: '触发止损线',
    take_profit: '触发止盈线',
  };

  return (
    <div className="space-y-6">
      <div className="card text-center">
        <h2 className="font-serif text-xl font-bold mb-2">{record.configName}</h2>
        <p className="text-sm text-neutral-500 mb-6">
          <Calendar size={14} className="inline mr-1" />
          {record.startTime} - {record.endTime}
        </p>

        <div className={`text-5xl font-bold font-mono mb-2 ${getReturnColor(totalReturnPercent)}`}>
          {totalReturn >= 0 ? '+' : ''}
          <NumberScroll value={totalReturnPercent * 100} decimals={2} suffix="%" />
        </div>
        <p className={`text-lg font-medium ${getReturnColor(totalReturnPercent)}`}>
          {totalReturn >= 0 ? (
            <TrendingUp className="inline mr-1" size={20} />
          ) : (
            <TrendingDown className="inline mr-1" size={20} />
          )}
          {formatCurrency(totalReturn)}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <Target size={24} className="mx-auto mb-2 text-primary-500" />
          <p className="text-xs text-neutral-500 mb-1">初始资金</p>
          <p className="font-mono font-bold">{formatCurrency(initialCapital)}</p>
        </div>
        <div className="card text-center">
          <Award size={24} className="mx-auto mb-2 text-success-500" />
          <p className="text-xs text-neutral-500 mb-1">最终资金</p>
          <p className="font-mono font-bold">{formatCurrency(finalCapital)}</p>
        </div>
        <div className="card text-center">
          <BarChart3 size={24} className="mx-auto mb-2 text-warning-500" />
          <p className="text-xs text-neutral-500 mb-1">交易次数</p>
          <p className="font-mono font-bold">{settlement.tradeCount}</p>
        </div>
        <div className="card text-center">
          <TrendingUp size={24} className="mx-auto mb-2 text-primary-500" />
          <p className="text-xs text-neutral-500 mb-1">胜率</p>
          <p className="font-mono font-bold">{formatPercent(settlement.winRate)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs text-neutral-500 mb-1">年化收益率</p>
          <p className={`text-xl font-mono font-bold ${getReturnColor(settlement.annualizedReturn)}`}>
            {formatPercent(settlement.annualizedReturn)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-neutral-500 mb-1">最大回撤</p>
          <p className="text-xl font-mono font-bold text-danger-500">
            {formatPercent(-settlement.maxDrawdown)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-neutral-500 mb-1">结算原因</p>
          <p className="text-sm font-medium text-neutral-700">
            {settleReasonMap[settlement.triggerCondition] || settlement.triggerCondition}
          </p>
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="card">
          <h3 className="font-serif text-lg font-semibold mb-4">收益率曲线</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E6EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#86909C" />
                <YAxis tick={{ fontSize: 12 }} stroke="#86909C" unit="%" />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)}%`, '收益率']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E6EB',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="收益率"
                  stroke="#165DFF"
                  strokeWidth={2}
                  dot={{ fill: '#165DFF', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
