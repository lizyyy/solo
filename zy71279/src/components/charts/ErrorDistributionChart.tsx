import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { ErrorAnalysis } from '@/types';

interface ErrorDistributionChartProps {
  errorAnalysis: ErrorAnalysis | null;
  height?: number;
}

export const ErrorDistributionChart: React.FC<ErrorDistributionChartProps> = ({
  errorAnalysis,
  height = 300
}) => {
  if (!errorAnalysis) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <p className="text-gray-400 text-sm">暂无误差数据</p>
      </div>
    );
  }

  const data = errorAnalysis.errorDistribution.map((item, index) => ({
    name: `${item.range[0].toFixed(3)} - ${item.range[1].toFixed(3)}`,
    value: item.count,
    itemStyle: {
      color: item.range[1] > errorAnalysis.maxError * 0.8
        ? '#ef4444'
        : item.range[1] > errorAnalysis.maxError * 0.5
          ? '#f59e0b'
          : '#10b981'
    }
  }));

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const param = Array.isArray(params) ? params[0] : params;
        if (!param) return '';
        return `误差区间: ${param.name} mm<br/>采样点数: ${param.value}`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLabel: {
        rotate: 45,
        fontSize: 10,
        interval: Math.floor(data.length / 8)
      },
      axisTick: { alignWithLabel: true }
    },
    yAxis: {
      type: 'value',
      name: '采样点数',
      nameTextStyle: { fontSize: 11 }
    },
    series: [{
      type: 'bar',
      barWidth: '80%',
      data: data,
      markLine: {
        silent: true,
        lineStyle: { type: 'dashed', color: '#ef4444' },
        data: [{
          name: '误差阈值',
          xAxis: errorAnalysis.maxError,
          label: {
            formatter: `阈值: ${errorAnalysis.maxError.toFixed(4)} mm`,
            fontSize: 10
          }
        }]
      }
    }]
  };

  return (
    <div className="w-full" style={{ height }}>
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};
