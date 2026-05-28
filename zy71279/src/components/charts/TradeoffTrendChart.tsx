import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { EstimationTask, ErrorAnalysis, PrintEstimation } from '@/types';

interface TrendData {
  task: EstimationTask;
  errorAnalysis?: ErrorAnalysis;
  printEstimation?: PrintEstimation;
}

interface TradeoffTrendChartProps {
  data: TrendData[];
  height?: number;
}

export const TradeoffTrendChart: React.FC<TradeoffTrendChartProps> = ({
  data,
  height = 350
}) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <p className="text-gray-400 text-sm">暂无趋势数据</p>
      </div>
    );
  }

  const sortedData = [...data].sort((a, b) => a.task.simplifiedFaces - b.task.simplifiedFaces);

  const xData = sortedData.map(d => d.task.simplifiedFaces);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: unknown) => {
        const paramArray = Array.isArray(params) ? params : [];
        if (paramArray.length === 0) return '';
        const first = paramArray[0] as { axisValue?: number };
        let html = `<div class="font-medium">面数: ${first.axisValue?.toLocaleString()}</div>`;
        paramArray.forEach((item: { seriesName?: string; value?: number; color?: string }) => {
          const unit = item.seriesName?.includes('误差') ? ' mm' :
                       item.seriesName?.includes('时间') ? ' 小时' :
                       item.seriesName?.includes('成本') ? ' 元' : '';
          html += `<div style="color:${item.color}">${item.seriesName}: ${item.value?.toFixed(4)}${unit}</div>`;
        });
        return html;
      }
    },
    legend: {
      data: ['最大误差', '平均误差', '打印时间', '总成本'],
      top: 0,
      textStyle: { fontSize: 11 }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '15%'
    },
    xAxis: {
      type: 'category',
      name: '简化后面数',
      nameTextStyle: { fontSize: 11 },
      data: xData,
      axisLabel: {
        fontSize: 10,
        rotate: 30,
        formatter: (value: number) => value.toLocaleString()
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '误差 (mm)',
        position: 'left',
        nameTextStyle: { fontSize: 11, color: '#ef4444' },
        axisLabel: { fontSize: 10, color: '#ef4444' }
      },
      {
        type: 'value',
        name: '时间/成本',
        position: 'right',
        nameTextStyle: { fontSize: 11, color: '#3b82f6' },
        axisLabel: { fontSize: 10, color: '#3b82f6' }
      }
    ],
    series: [
      {
        name: '最大误差',
        type: 'line',
        yAxisIndex: 0,
        data: sortedData.map(d => d.errorAnalysis?.maxError || null),
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 2, color: '#ef4444' },
        itemStyle: { color: '#ef4444' }
      },
      {
        name: '平均误差',
        type: 'line',
        yAxisIndex: 0,
        data: sortedData.map(d => d.errorAnalysis?.meanError || null),
        smooth: true,
        symbol: 'diamond',
        symbolSize: 8,
        lineStyle: { width: 2, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b' }
      },
      {
        name: '打印时间',
        type: 'line',
        yAxisIndex: 1,
        data: sortedData.map(d => d.printEstimation?.printTimeHours || null),
        smooth: true,
        symbol: 'square',
        symbolSize: 8,
        lineStyle: { width: 2, color: '#3b82f6' },
        itemStyle: { color: '#3b82f6' }
      },
      {
        name: '总成本',
        type: 'line',
        yAxisIndex: 1,
        data: sortedData.map(d => d.printEstimation?.totalCost || null),
        smooth: true,
        symbol: 'triangle',
        symbolSize: 8,
        lineStyle: { width: 2, color: '#10b981' },
        itemStyle: { color: '#10b981' }
      }
    ]
  };

  return (
    <div className="w-full" style={{ height }}>
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};
