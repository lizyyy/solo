import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { EstimationTask, ErrorAnalysis, PrintEstimation, Material } from '@/types';

interface ComparisonData {
  task: EstimationTask;
  errorAnalysis?: ErrorAnalysis;
  printEstimation?: PrintEstimation;
  material?: Material;
}

interface ScatterComparisonChartProps {
  data: ComparisonData[];
  height?: number;
  xAxis?: 'faceCount' | 'simplificationRatio';
  yAxis?: 'maxError' | 'meanError' | 'printTime' | 'cost';
}

export const ScatterComparisonChart: React.FC<ScatterComparisonChartProps> = ({
  data,
  height = 350,
  xAxis = 'faceCount',
  yAxis = 'maxError'
}) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <p className="text-gray-400 text-sm">暂无对比数据</p>
      </div>
    );
  }

  const getXValue = (item: ComparisonData): number => {
    return xAxis === 'faceCount' ? item.task.simplifiedFaces : item.task.simplificationRatio * 100;
  };

  const getYValue = (item: ComparisonData): number | undefined => {
    switch (yAxis) {
      case 'maxError':
        return item.errorAnalysis?.maxError;
      case 'meanError':
        return item.errorAnalysis?.meanError;
      case 'printTime':
        return item.printEstimation?.printTimeHours;
      case 'cost':
        return item.printEstimation?.totalCost;
      default:
        return undefined;
    }
  };

  const xAxisLabel = xAxis === 'faceCount' ? '简化后面数' : '简化比例 (%)';
  const yAxisLabel = {
    maxError: '最大误差 (mm)',
    meanError: '平均误差 (mm)',
    printTime: '打印时间 (小时)',
    cost: '总成本 (元)'
  }[yAxis];

  const scatterData = data
    .filter(item => getYValue(item) !== undefined)
    .map((item, index) => ({
      value: [getXValue(item), getYValue(item)],
      name: item.task.modelName,
      itemStyle: {
        color: index === 0 ? '#3b82f6' :
               index === 1 ? '#10b981' :
               index === 2 ? '#f59e0b' :
               index === 3 ? '#ef4444' : '#8b5cf6'
      },
      symbolSize: 12,
      taskId: item.task.id
    }));

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const param = params as { data?: { name?: string; value?: number[] } };
        if (!param?.data) return '';
        return `${param.data.name}<br/>${xAxisLabel}: ${param.data.value?.[0]}<br/>${yAxisLabel}: ${param.data.value?.[1]?.toFixed(4)}`;
      }
    },
    grid: {
      left: '10%',
      right: '5%',
      bottom: '10%',
      top: '10%'
    },
    xAxis: {
      type: 'value',
      name: xAxisLabel,
      nameTextStyle: { fontSize: 11 },
      axisLabel: { fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      name: yAxisLabel,
      nameTextStyle: { fontSize: 11 },
      axisLabel: { fontSize: 10 }
    },
    series: [{
      type: 'scatter',
      data: scatterData,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        }
      }
    }]
  };

  return (
    <div className="w-full" style={{ height }}>
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};
