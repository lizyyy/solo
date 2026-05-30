import { useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Copy } from 'lucide-react';
import { useCarbonStore } from '@/store/useCarbonStore';
import TraceableNumber from '@/components/TraceableNumber';
import AnomalyBanner from '@/components/AnomalyBanner';

export default function HedgingMatch() {
  const { hedgingDetail, loading, fetchHedgingDetail, fetchAnomalies } = useCarbonStore();

  useEffect(() => {
    fetchHedgingDetail();
    fetchAnomalies();
  }, [fetchHedgingDetail, fetchAnomalies]);

  if (loading.hedging) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-forest-green border-t-transparent" />
      </div>
    );
  }

  if (!hedgingDetail) {
    return <div className="flex h-96 items-center justify-center text-cool-gray">暂无数据</div>;
  }

  const sankeyOption = {
    series: [
      {
        type: 'sankey',
        layout: 'none',
        emphasis: { focus: 'adjacency' },
        nodeAlign: 'left' as const,
        data: hedgingDetail.sankeyData.nodes,
        links: hedgingDetail.sankeyData.links,
        lineStyle: { color: 'gradient', curveness: 0.5 },
        itemStyle: { borderWidth: 0 },
        label: { fontSize: 12, color: '#374151' },
      },
    ],
    tooltip: { trigger: 'item' as const },
  };

  const barOption = {
    grid: { top: 30, right: 20, bottom: 40, left: 60 },
    legend: { data: ['锁定价', '市场价'], top: 0 },
    xAxis: {
      type: 'category' as const,
      data: hedgingDetail.priceComparison.map((r) => r.contractNo),
      axisLabel: { fontSize: 11, color: '#6B7280', rotate: 30 },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { fontSize: 11, color: '#6B7280' },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    series: [
      {
        name: '锁定价',
        type: 'bar',
        data: hedgingDetail.priceComparison.map((r) => r.lockedPrice),
        itemStyle: { color: '#0D4B3C' },
        barWidth: '30%',
      },
      {
        name: '市场价',
        type: 'bar',
        data: hedgingDetail.priceComparison.map((r) => r.marketPrice),
        itemStyle: { color: '#D4A843' },
        barWidth: '30%',
      },
    ],
    tooltip: { trigger: 'axis' as const },
  };

  return (
    <div>
      <AnomalyBanner />
      <h2 className="mb-6 font-serif text-2xl text-forest-green">锁价匹配</h2>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm text-cool-gray">匹配率</p>
          <p className="mt-1 font-serif text-2xl font-bold text-forest-green">
            {(hedgingDetail.matchRate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm text-cool-gray">已锁价金额</p>
          <p className="mt-1 font-serif text-2xl font-bold text-forest-green">
            <TraceableNumber value={hedgingDetail.lockedAmount} targetType="hedging" targetId="locked" suffix="万元" />
          </p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm text-cool-gray">待采购金额</p>
          <p className="mt-1 font-serif text-2xl font-bold text-amber-accent-600">
            <TraceableNumber value={hedgingDetail.pendingAmount} targetType="hedging" targetId="pending" suffix="万元" />
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-serif text-lg text-forest-green">锁价合约表</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-cool-gray">
                <th className="pb-3 pr-4 font-medium">合约编号</th>
                <th className="pb-3 pr-4 font-medium">锁定价</th>
                <th className="pb-3 pr-4 font-medium">数量</th>
                <th className="pb-3 pr-4 font-medium">有效期</th>
                <th className="pb-3 pr-4 font-medium">来源</th>
                <th className="pb-3 font-medium">重复状态</th>
              </tr>
            </thead>
            <tbody>
              {hedgingDetail.contracts.map((row, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-800">{row.contractNo}</td>
                  <td className="py-3 pr-4">
                    <TraceableNumber value={row.lockedPrice} targetType="contract" targetId={row.contractNo} suffix="元/t" />
                  </td>
                  <td className="py-3 pr-4">{row.quantity.toLocaleString()} tCO₂</td>
                  <td className="py-3 pr-4 text-cool-gray">{row.validPeriod}</td>
                  <td className="py-3 pr-4 text-xs text-cool-gray">{row.source}</td>
                  <td className="py-3">
                    {row.duplicateStatus === 'duplicate' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-accent-600">
                        <Copy className="h-3 w-3" />
                        重复
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                        正常
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-serif text-lg text-forest-green">匹配流向</h3>
        <ReactECharts option={sankeyOption} style={{ height: 300 }} />
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-serif text-lg text-forest-green">市场价格对比</h3>
        <ReactECharts option={barOption} style={{ height: 300 }} />
      </div>
    </div>
  );
}
