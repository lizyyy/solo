import { useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { ArrowUpRight } from 'lucide-react';
import { useCarbonStore } from '@/store/useCarbonStore';
import TraceableNumber from '@/components/TraceableNumber';
import AnomalyBanner from '@/components/AnomalyBanner';

export default function BudgetAlert() {
  const { budgetDetail, loading, fetchBudgetDetail, fetchAnomalies } = useCarbonStore();

  useEffect(() => {
    fetchBudgetDetail();
    fetchAnomalies();
  }, [fetchBudgetDetail, fetchAnomalies]);

  if (loading.budget) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-forest-green border-t-transparent" />
      </div>
    );
  }

  if (!budgetDetail) {
    return <div className="flex h-96 items-center justify-center text-cool-gray">暂无数据</div>;
  }

  const gaugeColor =
    budgetDetail.usagePercent > 90 ? '#DC2626' : budgetDetail.usagePercent > 70 ? '#D4A843' : '#0D4B3C';

  const gaugeOption = {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 10,
        itemStyle: { color: gaugeColor },
        progress: { show: true, width: 18 },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 18, color: [[1, '#E5E7EB']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          fontSize: 28,
          fontFamily: 'DM Serif Display',
          color: gaugeColor,
          offsetCenter: [0, '0%'],
        },
        title: {
          offsetCenter: [0, '30%'],
          fontSize: 13,
          color: '#6B7280',
        },
        data: [{ value: budgetDetail.usagePercent, name: '预算使用率' }],
      },
    ],
  };

  return (
    <div>
      <AnomalyBanner />
      <h2 className="mb-6 font-serif text-2xl text-forest-green">预算预警</h2>

      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-serif text-lg text-forest-green">预算对比表</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-cool-gray">
                <th className="pb-3 pr-4 font-medium">类别</th>
                <th className="pb-3 pr-4 font-medium">预算</th>
                <th className="pb-3 pr-4 font-medium">实际</th>
                <th className="pb-3 pr-4 font-medium">差额</th>
                <th className="pb-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {budgetDetail.categories.map((row, i) => {
                const diff = row.actual - row.budget;
                const overBudget = diff > 0;
                return (
                  <tr key={i} className={`border-b border-gray-50 ${overBudget ? 'bg-red-50/50' : ''}`}>
                    <td className="py-3 pr-4 font-medium text-gray-800">{row.name}</td>
                    <td className="py-3 pr-4">{row.budget.toLocaleString()} 万元</td>
                    <td className="py-3 pr-4 font-medium">{row.actual.toLocaleString()} 万元</td>
                    <td className={`py-3 pr-4 font-medium ${overBudget ? 'text-warm-red' : 'text-emerald-600'}`}>
                      {overBudget ? '+' : ''}{diff.toLocaleString()} 万元
                    </td>
                    <td className="py-3">
                      {overBudget ? (
                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-warm-red">
                          超支
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                          正常
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-5">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-serif text-lg text-forest-green">预算使用率</h3>
          <ReactECharts option={gaugeOption} style={{ height: 240 }} />
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-serif text-lg text-forest-green">预警阈值</h3>
          <div className="space-y-3">
            {budgetDetail.alertRules.map((rule, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                <span className="text-sm text-gray-700">{rule.level}</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-accent-600">
                  {rule.threshold}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-serif text-lg text-forest-green">资金来源追踪</h3>
        <div className="space-y-3">
          {budgetDetail.fundSources.map((source, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 transition-colors hover:border-forest-green-200"
            >
              <div className="flex items-center gap-3">
                <ArrowUpRight className="h-4 w-4 text-forest-green" />
                <span className="text-sm font-medium text-gray-800">{source.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <TraceableNumber
                  value={source.amount}
                  targetType={source.targetType}
                  targetId={source.targetId}
                  suffix="万元"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
