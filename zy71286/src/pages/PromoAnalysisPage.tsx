import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Tag, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store';
import { PRODUCT_STATUSES, STATUS_LABELS, STATUS_COLORS } from '@/types';
import StatusBadge from '@/components/StatusBadge';

export default function PromoAnalysisPage() {
  const { promoMatrix, nonPromoMatrix, isLoading, anomalies } = useAppStore();

  const distortionAnomalies = useMemo(
    () => anomalies.filter(a => a.type === 'PROMO_DISTORT' && !a.isResolved),
    [anomalies]
  );

  const comparisonData = useMemo(() => {
    if (!promoMatrix || !nonPromoMatrix) return [];

    return PRODUCT_STATUSES.flatMap((from, i) =>
      PRODUCT_STATUSES.map((to, j) => ({
        from,
        to,
        promoProb: promoMatrix.probabilities[i][j],
        nonPromoProb: nonPromoMatrix.probabilities[i][j],
        diff: promoMatrix.probabilities[i][j] - nonPromoMatrix.probabilities[i][j],
        promoSample: promoMatrix.sampleCounts[i][j],
        nonPromoSample: nonPromoMatrix.sampleCounts[i][j],
      }))
    );
  }, [promoMatrix, nonPromoMatrix]);

  const significantDiffs = useMemo(
    () => comparisonData.filter(d => Math.abs(d.diff) > 0.05),
    [comparisonData]
  );

  const comparisonChartOption = useMemo(() => {
    if (comparisonData.length === 0) return {};

    const data = comparisonData.map(d => [
      PRODUCT_STATUSES.indexOf(d.to),
      PRODUCT_STATUSES.indexOf(d.from),
      d.diff,
    ]);

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const i = params.data[1];
          const j = params.data[0];
          const diff = params.data[2];
          const item = comparisonData.find(
            d => d.from === PRODUCT_STATUSES[i] && d.to === PRODUCT_STATUSES[j]
          );
          if (!item) return '';

          const diffPercent = (diff * 100).toFixed(1);
          const promoPercent = (item.promoProb * 100).toFixed(1);
          const nonPromoPercent = (item.nonPromoProb * 100).toFixed(1);

          return `
            <div style="font-family: Inter, sans-serif; padding: 4px;">
              <div style="font-weight: 600; margin-bottom: 4px;">
                ${STATUS_LABELS[item.from]} → ${STATUS_LABELS[item.to]}
              </div>
              <div style="font-size: 12px; color: #d69e2e;">
                促销期: ${promoPercent}% (n=${item.promoSample})
              </div>
              <div style="font-size: 12px; color: #486581;">
                非促销期: ${nonPromoPercent}% (n=${item.nonPromoSample})
              </div>
              <div style="font-size: 12px; margin-top: 4px; font-weight: 600; color: ${diff >= 0 ? '#2f855a' : '#c53030'};">
                差异: ${diff >= 0 ? '+' : ''}${diffPercent}%
              </div>
            </div>
          `;
        },
      },
      grid: {
        top: 30,
        bottom: 60,
        left: 80,
        right: 40,
      },
      xAxis: {
        type: 'category',
        data: PRODUCT_STATUSES.map(s => STATUS_LABELS[s]),
        axisLabel: { fontSize: 12, color: '#243b53' },
        axisLine: { lineStyle: { color: '#bcccdc' } },
      },
      yAxis: {
        type: 'category',
        data: PRODUCT_STATUSES.map(s => STATUS_LABELS[s]),
        axisLabel: { fontSize: 12, color: '#243b53' },
        axisLine: { lineStyle: { color: '#bcccdc' } },
      },
      visualMap: {
        min: -0.3,
        max: 0.3,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        text: ['促销提升', '促销抑制'],
        textStyle: { fontSize: 11, color: '#486581' },
        inRange: {
          color: ['#c53030', '#e53e3e', '#fc8181', '#f7fafc', '#68d391', '#38a169', '#276749'],
        },
      },
      series: [
        {
          name: '概率差异',
          type: 'heatmap',
          data,
          label: {
            show: true,
            formatter: (params: any) => {
              const diff = params.data[2];
              const percent = (diff * 100).toFixed(1);
              return Math.abs(diff) > 0.02 ? `${diff >= 0 ? '+' : ''}${percent}%` : '';
            },
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            fontWeight: 600,
            color: '#fff',
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2,
            borderRadius: 4,
          },
        },
      ],
    };
  }, [comparisonData]);

  const topImpacts = useMemo(() => {
    return significantDiffs
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 6);
  }, [significantDiffs]);

  if (isLoading || !promoMatrix || !nonPromoMatrix) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-navy-500">
          <div className="text-4xl mb-2 animate-pulse">🏷️</div>
          <div>加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="section-title">促销切片分析</h2>
        <p className="section-subtitle">
          对比促销期与非促销期的状态转移模式，量化促销活动对商品状态流转的干扰影响
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <div className="stat-value text-brand-600">
                {promoMatrix.sampleCounts.flat().reduce((a, b) => a + b, 0)}
              </div>
              <div className="stat-label">促销期转移</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-navy-50 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-navy-500" />
            </div>
            <div>
              <div className="stat-value text-navy-600">
                {nonPromoMatrix.sampleCounts.flat().reduce((a, b) => a + b, 0)}
              </div>
              <div className="stat-label">非促销期转移</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-success-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <div className="stat-value text-success-600">
                {significantDiffs.filter(d => d.diff > 0).length}
              </div>
              <div className="stat-label">促销促进路径</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-danger-50 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-danger-500" />
            </div>
            <div>
              <div className="stat-value text-danger-600">
                {significantDiffs.filter(d => d.diff < 0).length}
              </div>
              <div className="stat-label">促销抑制路径</div>
            </div>
          </div>
        </div>
      </div>

      {distortionAnomalies.length > 0 && (
        <div className="bg-gradient-to-r from-brand-50 to-white border-l-4 border-brand-500 rounded-r-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-navy-900 mb-1">
                检测到 {distortionAnomalies.length} 项促销干扰异常
              </h4>
              <p className="text-sm text-navy-600">
                促销活动对部分转移路径产生显著影响，建议在预测时采用分层模型分别计算
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="font-display text-lg font-semibold text-navy-900">
            转移概率差异热力图
          </h3>
          <p className="text-sm text-navy-500 mt-0.5">
            正值表示促销提升该转移概率，负值表示促销抑制该转移概率
          </p>
        </div>
        <div className="card-body">
          <ReactECharts
            option={comparisonChartOption}
            style={{ height: '420px', width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              促销期转移矩阵
            </h3>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-navy-500 font-medium">从\到</th>
                    {PRODUCT_STATUSES.map(s => (
                      <th key={s} className="p-2 text-navy-700 font-medium text-center">
                        <StatusBadge status={s} size="sm" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRODUCT_STATUSES.map((from, i) => (
                    <tr key={from} className="border-t border-navy-100">
                      <td className="p-2 font-medium text-navy-700">
                        <StatusBadge status={from} size="sm" />
                      </td>
                      {PRODUCT_STATUSES.map((to, j) => {
                        const prob = promoMatrix.probabilities[i][j];
                        const sample = promoMatrix.sampleCounts[i][j];
                        const diff = comparisonData.find(
                          d => d.from === from && d.to === to
                        )?.diff || 0;
                        return (
                          <td
                            key={to}
                            className={`p-2 text-center font-mono ${
                              Math.abs(diff) > 0.05
                                ? diff > 0
                                  ? 'bg-success-50 text-success-700'
                                  : 'bg-danger-50 text-danger-700'
                                : 'text-navy-700'
                            }`}
                          >
                            <div className="font-semibold">{(prob * 100).toFixed(1)}%</div>
                            <div className="text-xs opacity-60">n={sample}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              非促销期转移矩阵
            </h3>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-navy-500 font-medium">从\到</th>
                    {PRODUCT_STATUSES.map(s => (
                      <th key={s} className="p-2 text-navy-700 font-medium text-center">
                        <StatusBadge status={s} size="sm" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRODUCT_STATUSES.map((from, i) => (
                    <tr key={from} className="border-t border-navy-100">
                      <td className="p-2 font-medium text-navy-700">
                        <StatusBadge status={from} size="sm" />
                      </td>
                      {PRODUCT_STATUSES.map((to, j) => {
                        const prob = nonPromoMatrix.probabilities[i][j];
                        const sample = nonPromoMatrix.sampleCounts[i][j];
                        return (
                          <td key={to} className="p-2 text-center font-mono text-navy-700">
                            <div className="font-semibold">{(prob * 100).toFixed(1)}%</div>
                            <div className="text-xs opacity-60">n={sample}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {topImpacts.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              促销影响最大的 {topImpacts.length} 条转移路径
            </h3>
            <p className="text-sm text-navy-500 mt-0.5">
              按概率差异绝对值排序，供清仓决策时重点参考
            </p>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-4">
              {topImpacts.map((item, idx) => (
                <div
                  key={`${item.from}-${item.to}`}
                  className={`rounded-xl p-4 border-2 ${
                    item.diff > 0
                      ? 'bg-success-50 border-success-200'
                      : 'bg-danger-50 border-danger-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.from} size="sm" />
                      <span className="text-navy-400">→</span>
                      <StatusBadge status={item.to} size="sm" />
                    </div>
                    <span className="text-xs text-navy-500 font-mono">#{idx + 1}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-navy-600">促销期</span>
                      <span className="font-mono font-bold text-brand-600">
                        {(item.promoProb * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-navy-600">非促销期</span>
                      <span className="font-mono text-navy-600">
                        {(item.nonPromoProb * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="pt-2 border-t border-navy-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-navy-600">差异</span>
                        <span
                          className={`font-mono font-bold ${
                            item.diff > 0 ? 'text-success-600' : 'text-danger-600'
                          }`}
                        >
                          {item.diff > 0 ? '+' : ''}
                          {(item.diff * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
