import { useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, ShieldCheck, ShoppingCart, Banknote } from 'lucide-react';
import { useCarbonStore } from '@/store/useCarbonStore';
import AnomalyBanner from '@/components/AnomalyBanner';
import TraceableNumber from '@/components/TraceableNumber';

const STAT_CARDS = [
  {
    key: 'gap' as const,
    label: '配额缺口',
    icon: TrendingUp,
    gradient: 'from-warm-red to-red-400',
    unit: 'tCO₂',
    targetKey: 'gap',
  },
  {
    key: 'matchedAmount' as const,
    label: '已锁价量',
    icon: ShieldCheck,
    gradient: 'from-forest-green to-emerald-500',
    unit: 'tCO₂',
    targetKey: 'matched',
  },
  {
    key: 'unmatchedGap' as const,
    label: '待采购量',
    icon: ShoppingCart,
    gradient: 'from-amber-accent to-amber-400',
    unit: 'tCO₂',
    targetKey: 'unmatched',
  },
  {
    key: 'fundNeeded' as const,
    label: '资金需求',
    icon: Banknote,
    gradient: 'from-blue-600 to-blue-400',
    unit: '万元',
    targetKey: 'fund',
  },
];

export default function Overview() {
  const { overview, loading, fetchOverview, fetchAnomalies, anomalies } = useCarbonStore();

  useEffect(() => {
    fetchOverview();
    fetchAnomalies();
  }, [fetchOverview, fetchAnomalies]);

  if (loading.overview) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-forest-green border-t-transparent" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex h-96 items-center justify-center text-cool-gray">
        暂无数据
      </div>
    );
  }

  const budgetUsed = overview.budgetStatus.used;
  const budgetTotal = overview.budgetStatus.total;
  const budgetPercent = budgetTotal > 0 ? Math.round((budgetUsed / budgetTotal) * 100) : 0;

  const ringColor =
    budgetPercent > 90 ? '#DC2626' : budgetPercent > 70 ? '#D4A843' : '#0D4B3C';

  const ringOption = {
    series: [
      {
        type: 'pie',
        radius: ['65%', '85%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: `{a|${budgetPercent}%}\n{b|预算使用率}`,
          rich: {
            a: { fontSize: 28, fontWeight: 'bold', color: ringColor, fontFamily: 'DM Serif Display' },
            b: { fontSize: 12, color: '#6B7280', padding: [4, 0, 0, 0] },
          },
        },
        data: [
          { value: budgetUsed, itemStyle: { color: ringColor } },
          { value: budgetTotal - budgetUsed, itemStyle: { color: '#E5E7EB' } },
        ],
      },
    ],
  };

  const trendOption = {
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category' as const,
      data: overview.tradeRecords.map((r) => r.date),
      axisLine: { lineStyle: { color: '#D1D5DB' } },
      axisLabel: { fontSize: 11, color: '#6B7280' },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { fontSize: 11, color: '#6B7280' },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    series: [
      {
        type: 'line',
        data: overview.tradeRecords.map((r) => r.price),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#0D4B3C', width: 2 },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(13,75,60,0.15)' },
              { offset: 1, color: 'rgba(13,75,60,0.01)' },
            ],
          },
        },
      },
    ],
    tooltip: { trigger: 'axis' as const },
  };

  return (
    <div>
      <AnomalyBanner />

      <h2 className="mb-6 font-serif text-2xl text-forest-green">数据总览</h2>

      <div className="mb-8 grid grid-cols-4 gap-5">
        {STAT_CARDS.map(({ key, label, icon: Icon, gradient, unit, targetKey }) => (
          <div
            key={key}
            className="overflow-hidden rounded-lg bg-white shadow-sm"
          >
            <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
            <div className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-cool-gray" />
                <span className="text-sm text-cool-gray">{label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                <TraceableNumber
                  value={overview[key]}
                  targetType="overview"
                  targetId={targetKey}
                  suffix={unit}
                />
              </div>
              {key === 'gap' && (
                <p className="mt-2 text-xs text-cool-gray">
                  排放 <span className="font-medium text-gray-700">{overview.emission.toLocaleString()}</span>
                  {' / '}配额 <span className="font-medium text-gray-700">{overview.allowance.toLocaleString()}</span>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-serif text-lg text-forest-green">预算使用状态</h3>
          <ReactECharts option={ringOption} style={{ height: 220 }} />
        </div>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-serif text-lg text-forest-green">市场价格趋势</h3>
          <ReactECharts option={trendOption} style={{ height: 220 }} />
        </div>
      </div>
    </div>
  );
}
