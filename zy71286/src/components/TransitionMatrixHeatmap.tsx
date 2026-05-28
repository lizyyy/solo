import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { TransitionMatrix, ProductStatus } from '@/types';
import { PRODUCT_STATUSES, STATUS_LABELS, STATUS_COLORS } from '@/types';
import { calculateConfidenceRating } from '@/utils/anomalyDetection';
import type { AnomalyRecord } from '@/types';

interface TransitionMatrixHeatmapProps {
  matrix: TransitionMatrix | null;
  anomalies: AnomalyRecord[];
  selectedCell: { from: ProductStatus; to: ProductStatus } | null;
  onCellClick: (from: ProductStatus, to: ProductStatus) => void;
  title?: string;
  showSampleCount?: boolean;
}

export default function TransitionMatrixHeatmap({
  matrix,
  anomalies,
  selectedCell,
  onCellClick,
  title,
  showSampleCount = true,
}: TransitionMatrixHeatmapProps) {
  const confidence = useMemo(() => calculateConfidenceRating(anomalies), [anomalies]);

  const hasAnomaly = (from: ProductStatus, to: ProductStatus): boolean => {
    return anomalies.some(
      a => !a.isResolved && a.fromStatus === from && a.toStatus === to
    );
  };

  const getAnomalySeverity = (from: ProductStatus, to: ProductStatus): string | null => {
    const anomaly = anomalies.find(
      a => !a.isResolved && a.fromStatus === from && a.toStatus === to
    );
    return anomaly?.severity || null;
  };

  const option = useMemo(() => {
    if (!matrix) return {};

    const xData = PRODUCT_STATUSES.map(s => STATUS_LABELS[s]);
    const yData = [...PRODUCT_STATUSES].map(s => STATUS_LABELS[s]);

    const heatmapData: [number, number, number][] = [];
    const sampleData: string[][] = [];

    for (let i = 0; i < PRODUCT_STATUSES.length; i++) {
      sampleData[i] = [];
      for (let j = 0; j < PRODUCT_STATUSES.length; j++) {
        const prob = matrix.probabilities[i][j];
        heatmapData.push([j, i, prob]);
        sampleData[i][j] = `n=${matrix.sampleCounts[i][j]}`;
      }
    }

    return {
      title: title ? {
        text: title,
        left: 'center',
        top: 0,
        textStyle: {
          fontSize: 14,
          fontWeight: 600,
          color: '#243b53',
          fontFamily: 'Fraunces, serif',
        },
      } : undefined,
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const i = params.data[1];
          const j = params.data[0];
          const fromStatus = PRODUCT_STATUSES[i];
          const toStatus = PRODUCT_STATUSES[j];
          const prob = (params.data[2] * 100).toFixed(2);
          const samples = matrix.sampleCounts[i][j];
          const anomaly = getAnomalySeverity(fromStatus, toStatus);
          return `
            <div style="font-family: Inter, sans-serif; padding: 4px;">
              <div style="font-weight: 600; margin-bottom: 4px;">
                ${STATUS_LABELS[fromStatus]} → ${STATUS_LABELS[toStatus]}
              </div>
              <div style="font-size: 12px; color: #486581;">
                转移概率: <span style="font-weight: 600; color: #1a365d;">${prob}%</span>
              </div>
              <div style="font-size: 12px; color: #486581;">
                样本量: <span style="font-family: JetBrains Mono, monospace;">${samples}</span>
              </div>
              ${anomaly ? `<div style="font-size: 12px; color: #c53030; margin-top: 4px;">⚠️ 存在${anomaly === 'HIGH' ? '高风险' : anomaly === 'MEDIUM' ? '中风险' : '低风险'}异常</div>` : ''}
            </div>
          `;
        },
      },
      grid: {
        top: title ? 50 : 20,
        bottom: 60,
        left: 80,
        right: 40,
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLabel: {
          fontSize: 12,
          fontWeight: 500,
          color: '#243b53',
        },
        axisLine: { lineStyle: { color: '#bcccdc' } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: yData,
        axisLabel: {
          fontSize: 12,
          fontWeight: 500,
          color: '#243b53',
        },
        axisLine: { lineStyle: { color: '#bcccdc' } },
        splitLine: { show: false },
      },
      visualMap: {
        min: 0,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        text: ['高概率', '低概率'],
        textStyle: {
          fontSize: 11,
          color: '#486581',
        },
        inRange: {
          color: ['#f0f4f8', '#d9e2ec', '#9fb3c8', '#627d98', '#334e68', '#1a365d'],
        },
      },
      series: [
        {
          name: '转移概率',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            formatter: (params: any) => {
              const i = params.data[1];
              const j = params.data[0];
              const prob = (params.data[2] * 100).toFixed(1);
              const samples = matrix.sampleCounts[i][j];
              const hasIssue = hasAnomaly(PRODUCT_STATUSES[i], PRODUCT_STATUSES[j]);
              return showSampleCount
                ? `{prob|${prob}%}${samples > 0 ? `\n{count|n=${samples}}` : ''}${hasIssue ? '\n{warn|⚠}' : ''}`
                : `{prob|${prob}%}`;
            },
            rich: {
              prob: {
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                fontFamily: 'JetBrains Mono, monospace',
              },
              count: {
                fontSize: 10,
                color: 'rgba(255,255,255,0.8)',
                fontFamily: 'JetBrains Mono, monospace',
                padding: [2, 0, 0, 0],
              },
              warn: {
                fontSize: 12,
                padding: [2, 0, 0, 0],
              },
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(26, 54, 93, 0.5)',
            },
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2,
            borderRadius: 4,
          },
        },
      ],
    };
  }, [matrix, title, showSampleCount, anomalies]);

  const onChartClick = (params: any) => {
    if (params.componentType === 'series') {
      const i = params.data[1];
      const j = params.data[0];
      onCellClick(PRODUCT_STATUSES[i], PRODUCT_STATUSES[j]);
    }
  };

  if (!matrix) {
    return (
      <div className="flex items-center justify-center h-96 bg-navy-50 rounded-xl">
        <div className="text-center text-navy-500">
          <div className="text-4xl mb-2">📊</div>
          <div>加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-navy-600">置信度评分：</span>
            <span
              className="font-display text-2xl font-bold"
              style={{
                color: confidence.overall >= 80 ? '#2f855a' : confidence.overall >= 60 ? '#d69e2e' : '#c53030',
              }}
            >
              {confidence.overall}
            </span>
            <span className="text-sm text-navy-500">/100</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {confidence.breakdown.map(item => (
            <div key={item.category} className="text-center">
              <div
                className="font-mono text-sm font-semibold"
                style={{
                  color: item.score >= 80 ? '#2f855a' : item.score >= 60 ? '#d69e2e' : '#c53030',
                }}
              >
                {item.score}
              </div>
              <div className="text-xs text-navy-500">{item.category}</div>
            </div>
          ))}
        </div>
      </div>

      <ReactECharts
        option={option}
        style={{ height: '480px', width: '100%' }}
        onEvents={{ click: onChartClick }}
        opts={{ renderer: 'canvas' }}
      />

      <div className="flex items-center justify-between text-xs text-navy-500">
        <div>← 行表示源状态 | 列表示目标状态 →</div>
        <div>点击单元格查看原始记录</div>
      </div>
    </div>
  );
}
