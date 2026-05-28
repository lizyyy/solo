import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Clock, TrendingDown, AlertTriangle, Target } from 'lucide-react';
import { useAppStore } from '@/store';
import { PRODUCT_STATUSES, STATUS_LABELS, STATUS_COLORS } from '@/types';
import StatusBadge from '@/components/StatusBadge';

export default function ForecastPage() {
  const {
    transitionMatrix,
    forecastResults,
    absorbingAnalysis,
    forecastWeeks,
    isLoading,
    setForecastWeeks,
  } = useAppStore();

  const latestForecast = forecastResults[forecastResults.length - 1];
  const initialState = forecastResults[0];

  const lineChartOption = useMemo(() => {
    if (forecastResults.length === 0) return {};

    const weeks = forecastResults.map(f => `第${f.week}周`);
    const series = PRODUCT_STATUSES.map(status => ({
      name: STATUS_LABELS[status],
      type: 'line',
      smooth: true,
      lineStyle: {
        width: 3,
        color: STATUS_COLORS[status],
      },
      itemStyle: {
        color: STATUS_COLORS[status],
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: `${STATUS_COLORS[status]}40` },
            { offset: 1, color: `${STATUS_COLORS[status]}05` },
          ],
        },
      },
      data: forecastResults.map(f => (f.probabilities[status] * 100).toFixed(1)),
    }));

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(26, 54, 93, 0.95)',
        borderColor: 'transparent',
        textStyle: {
          color: '#fff',
          fontFamily: 'Inter, sans-serif',
        },
        formatter: (params: any) => {
          let html = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].axisValue}</div>`;
          params.forEach((p: any) => {
            html += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: ${p.color};"></span>
              <span>${p.seriesName}:</span>
              <span style="font-weight: 600; font-family: 'JetBrains Mono', monospace;">${p.data}%</span>
            </div>`;
          });
          return html;
        },
      },
      legend: {
        data: PRODUCT_STATUSES.map(s => STATUS_LABELS[s]),
        bottom: 0,
        textStyle: {
          color: '#486581',
        },
      },
      grid: {
        left: 60,
        right: 30,
        top: 30,
        bottom: 60,
      },
      xAxis: {
        type: 'category',
        data: weeks,
        axisLabel: {
          color: '#486581',
          fontSize: 11,
        },
        axisLine: { lineStyle: { color: '#bcccdc' } },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          formatter: '{value}%',
          color: '#486581',
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace',
        },
        axisLine: { lineStyle: { color: '#bcccdc' } },
        splitLine: {
          lineStyle: {
            color: '#d9e2ec',
            type: 'dashed',
          },
        },
      },
      series,
    };
  }, [forecastResults]);

  const pieChartOption = useMemo(() => {
    if (!latestForecast) return {};

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(26, 54, 93, 0.95)',
        textStyle: { color: '#fff' },
        formatter: '{b}: {c}% ({d}%)',
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '75%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#fff',
            borderWidth: 3,
          },
          label: {
            show: true,
            formatter: '{b}\n{c}%',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
          },
          data: PRODUCT_STATUSES.map(s => ({
            name: STATUS_LABELS[s],
            value: Number((latestForecast.probabilities[s] * 100).toFixed(1)),
            itemStyle: { color: STATUS_COLORS[s] },
          })),
        },
      ],
    };
  }, [latestForecast]);

  const absorptionData = useMemo(() => {
    if (!absorbingAnalysis) return [];

    return absorbingAnalysis.transientStates.map(state => ({
      state,
      slowProb: absorbingAnalysis.absorptionProbabilities[state]?.SLOW || 0,
      clearProb: absorbingAnalysis.absorptionProbabilities[state]?.CLEAR || 0,
      expectedWeeks: absorbingAnalysis.expectedTimeToAbsorption[state] || 0,
    }));
  }, [absorbingAnalysis]);

  if (isLoading || !transitionMatrix) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-navy-500">
          <div className="text-4xl mb-2 animate-pulse">📈</div>
          <div>加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="section-title">状态预测中心</h2>
          <p className="section-subtitle">
            基于马尔可夫链的多步预测，分析商品状态分布的长期演变趋势
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-navy-600">预测周期：</span>
            <input
              type="range"
              min="1"
              max="12"
              value={forecastWeeks}
              onChange={e => setForecastWeeks(Number(e.target.value))}
              className="w-40 accent-navy-800"
            />
            <span className="font-mono font-bold text-navy-900 w-16">
              {forecastWeeks} 周
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {initialState && PRODUCT_STATUSES.map(status => (
          <div key={status} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <StatusBadge status={status} size="sm" />
              <span className="text-xs text-navy-500">当前</span>
            </div>
            <div
              className="font-display text-2xl font-bold"
              style={{ color: STATUS_COLORS[status] }}
            >
              {(initialState.probabilities[status] * 100).toFixed(1)}%
            </div>
            <div className="mt-2">
              <div className="text-xs text-navy-500 mb-1">
                → 第{forecastWeeks}周预测
              </div>
              <div
                className="font-mono text-sm font-semibold"
                style={{ color: STATUS_COLORS[status] }}
              >
                {latestForecast && `${(latestForecast.probabilities[status] * 100).toFixed(1)}%`}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="card col-span-2">
          <div className="card-header">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              状态分布演变曲线
            </h3>
            <p className="text-sm text-navy-500 mt-0.5">
              未来 {forecastWeeks} 周各状态概率变化趋势，带95%置信区间
            </p>
          </div>
          <div className="card-body">
            <ReactECharts
              option={lineChartOption}
              style={{ height: '400px', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              第{forecastWeeks}周预测分布
            </h3>
          </div>
          <div className="card-body">
            <ReactECharts
              option={pieChartOption}
              style={{ height: '320px', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </div>
      </div>

      {absorbingAnalysis && (
        <div className="card">
          <div className="card-header flex items-center gap-3">
            <Target className="w-5 h-5 text-navy-700" />
            <div>
              <h3 className="font-display text-lg font-semibold text-navy-900">
                吸收态分析
              </h3>
              <p className="text-sm text-navy-500 mt-0.5">
                分析商品最终进入滞销/清仓状态的概率及期望时间
              </p>
            </div>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-6">
              {absorptionData.map(item => (
                <div
                  key={item.state}
                  className="bg-gradient-to-br from-navy-50 to-white rounded-xl p-5 border border-navy-100"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <StatusBadge status={item.state} />
                    <span className="text-xs text-navy-500">状态</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-navy-600 mb-2">
                        <TrendingDown className="w-4 h-4 text-warning-500" />
                        <span>最终滞销概率</span>
                      </div>
                      <div className="font-mono text-2xl font-bold text-warning-600">
                        {(item.slowProb * 100).toFixed(1)}%
                      </div>
                      <div className="mt-2 h-2 bg-navy-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-warning-500 rounded-full transition-all"
                          style={{ width: `${item.slowProb * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-sm text-navy-600 mb-2">
                        <AlertTriangle className="w-4 h-4 text-navy-500" />
                        <span>最终清仓概率</span>
                      </div>
                      <div className="font-mono text-2xl font-bold text-navy-600">
                        {(item.clearProb * 100).toFixed(1)}%
                      </div>
                      <div className="mt-2 h-2 bg-navy-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-navy-500 rounded-full transition-all"
                          style={{ width: `${item.clearProb * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-navy-100">
                      <div className="flex items-center gap-2 text-sm text-navy-600 mb-2">
                        <Clock className="w-4 h-4 text-success-500" />
                        <span>期望吸收时间</span>
                      </div>
                      <div className="font-mono text-2xl font-bold text-success-600">
                        {item.expectedWeeks.toFixed(1)} 周
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-navy-50 rounded-xl">
              <h4 className="font-semibold text-navy-900 mb-2">📊 分析结论</h4>
              <div className="text-sm text-navy-700 space-y-1">
                <p>
                  • 当前畅销品最终进入滞销状态的平均概率为
                  <span className="font-mono font-bold text-warning-600 mx-1">
                    {(absorptionData.find(d => d.state === 'HOT')?.slowProb || 0) * 100}%
                  </span>
                  ，期望时间
                  <span className="font-mono font-bold text-success-600 mx-1">
                    {absorptionData.find(d => d.state === 'HOT')?.expectedWeeks.toFixed(1)}
                  </span>
                  周
                </p>
                <p>
                  • 正常品最终被清仓的平均概率为
                  <span className="font-mono font-bold text-navy-600 mx-1">
                    {(absorptionData.find(d => d.state === 'NORMAL')?.clearProb || 0) * 100}%
                  </span>
                </p>
                <p className="text-navy-500 text-xs mt-2">
                  * 吸收态定义：滞销(SLOW)、清仓(CLEAR)，即一旦进入则难以转出的状态
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
